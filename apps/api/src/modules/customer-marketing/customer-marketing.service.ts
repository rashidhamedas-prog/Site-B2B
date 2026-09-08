import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { isStaffRole } from '../auth/staff-access';
import { isRetailCustomerType } from '../customer/customer-channel';
import { normalizePhone } from '../auth/phone.util';
import { OutboxService } from '../omnichannel/services/outbox.service';
import { OUTBOX_EVENT_TYPES } from '../omnichannel/omnichannel.constants';
import { SettingsService } from '../settings/settings.service';
import { tehranDayStart } from '../../lib/tehran-time';
import {
  ALWAYS_OFF_SCENARIOS,
  CALL_RESULTS,
  DEFAULT_MARKETING_SETTINGS,
  FUNNEL_CODES,
  SETTINGS_KEY,
  SMS_IR_BULK_MAX,
  effectiveMode,
  type CallResult,
  type ConsentSource,
  type MarketingChannel,
  type MarketingMode,
  type MessageClass,
} from './customer-marketing.constants';
import { decideConsent } from './consent-policy';
import { evaluateSendGate, fillTemplate } from './send-gates';
import { resolveMarketingSettings } from './marketing-settings';
import { daysBetween, isSettledOrderStatus, resolveStage } from './stage-machine';
import {
  MarketingActivityEntity,
  MarketingCampaignEntity,
  MarketingConsentEntity,
  MarketingEnrollmentEntity,
  MarketingFunnelEntity,
  MarketingSendEntity,
  MarketingSuppressionEntity,
  MarketingTemplateEntity,
} from './entities';

type Actor = { id?: string; role?: string };

@Injectable()
export class CustomerMarketingService {
  constructor(
    @InjectRepository(CustomerEntity) private readonly customers: Repository<CustomerEntity>,
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(MarketingConsentEntity) private readonly consents: Repository<MarketingConsentEntity>,
    @InjectRepository(MarketingSuppressionEntity) private readonly suppressions: Repository<MarketingSuppressionEntity>,
    @InjectRepository(MarketingFunnelEntity) private readonly funnels: Repository<MarketingFunnelEntity>,
    @InjectRepository(MarketingEnrollmentEntity) private readonly enrollments: Repository<MarketingEnrollmentEntity>,
    @InjectRepository(MarketingTemplateEntity) private readonly templates: Repository<MarketingTemplateEntity>,
    @InjectRepository(MarketingCampaignEntity) private readonly campaigns: Repository<MarketingCampaignEntity>,
    @InjectRepository(MarketingSendEntity) private readonly sends: Repository<MarketingSendEntity>,
    @InjectRepository(MarketingActivityEntity) private readonly activities: Repository<MarketingActivityEntity>,
    private readonly settings: SettingsService,
    private readonly outbox: OutboxService,
  ) {}

  async getSettings() {
    return resolveMarketingSettings(await this.settings.get(SETTINGS_KEY));
  }

  async patchSettings(patch: Record<string, unknown>, actor: Actor) {
    this.assertAdmin(actor);
    const current = await this.getSettings();
    const next = resolveMarketingSettings({ ...current, ...patch });
    if (next.mode === 'LIVE' && current.mode !== 'LIVE') this.assertAdmin(actor);
    if (next.treatRegisterAutoAsPromoConsent && !current.treatRegisterAutoAsPromoConsent) {
      this.assertAdmin(actor);
    }
    await this.settings.set(SETTINGS_KEY, next);
    return next;
  }

  channelOf(customer: CustomerEntity): MarketingChannel {
    return isRetailCustomerType(customer.type) ? 'RETAIL' : 'WHOLESALE';
  }

  async enroll(customerId: string, opts?: { actorId?: string; source?: ConsentSource }): Promise<{ enrolled: boolean; reason?: string }> {
    const customer = await this.customers.findOne({ where: { id: customerId } });
    if (!customer) return { enrolled: false, reason: 'NOT_FOUND' };
    if (await this.shouldSkipEnroll(customer)) return { enrolled: false, reason: 'SKIPPED' };

    const channel = this.channelOf(customer);
    const source: ConsentSource = opts?.source
      || (channel === 'RETAIL' ? 'OTP_RETAIL' : 'WHOLESALE_APPLICATION');
    await this.upsertConsent(customer.id, channel, 'REGISTER_AUTO', source, opts?.actorId);
    const funnel = await this.funnels.findOne({
      where: { channel, code: channel === 'RETAIL' ? FUNNEL_CODES.RETAIL : FUNNEL_CODES.WHOLESALE },
    });
    if (!funnel) return { enrolled: false, reason: 'FUNNEL_MISSING' };

    let enrollment = await this.enrollments.findOne({ where: { customerId: customer.id, funnelId: funnel.id } });
    const stage = channel === 'RETAIL' ? 'REGISTERED' : 'APPLIED';
    if (!enrollment) {
      enrollment = await this.enrollments.save(this.enrollments.create({
        customerId: customer.id,
        funnelId: funnel.id,
        status: 'ACTIVE',
        currentStepCode: stage,
        nextRunAt: new Date(),
        nextActionType: 'SMS',
        enrolledByUserId: opts?.actorId ?? null,
      }));
      await this.activity(customer.id, channel, 'ENROLL', { stage, source }, opts?.actorId);
    }

    await this.outbox.enqueue({
      operationId: `mkt-reg:${customer.id}:${channel}`,
      eventType: OUTBOX_EVENT_TYPES.CUSTOMER_REGISTERED_MARKETING,
      aggregateType: 'customer',
      aggregateId: customer.id,
      channel,
      payload: { customerId: customer.id },
    });
    return { enrolled: true };
  }

  async onApproved(customerId: string): Promise<void> {
    const customer = await this.customers.findOne({ where: { id: customerId } });
    if (!customer || isRetailCustomerType(customer.type)) return;
    await this.enroll(customerId, { source: 'WHOLESALE_APPLICATION' });
    const funnel = await this.funnels.findOne({ where: { channel: 'WHOLESALE', code: FUNNEL_CODES.WHOLESALE } });
    if (!funnel) return;
    const enrollment = await this.enrollments.findOne({ where: { customerId, funnelId: funnel.id } });
    if (enrollment) {
      enrollment.currentStepCode = 'APPROVED';
      enrollment.nextActionType = 'CALL';
      enrollment.nextRunAt = new Date(Date.now() + 86_400_000);
      await this.enrollments.save(enrollment);
    }
    await this.outbox.enqueue({
      operationId: `mkt-apr:${customerId}`,
      eventType: OUTBOX_EVENT_TYPES.CUSTOMER_APPROVED_MARKETING,
      aggregateType: 'customer',
      aggregateId: customerId,
      channel: 'WHOLESALE',
      payload: { customerId },
    });
  }

  async evaluateCustomer(customerId: string): Promise<void> {
    const customer = await this.customers.findOne({ where: { id: customerId } });
    if (!customer) return;
    const channel = this.channelOf(customer);
    const funnel = await this.funnels.findOne({
      where: { channel, code: channel === 'RETAIL' ? FUNNEL_CODES.RETAIL : FUNNEL_CODES.WHOLESALE },
    });
    if (!funnel) return;
    let enrollment = await this.enrollments.findOne({ where: { customerId, funnelId: funnel.id } });
    if (!enrollment) {
      const result = await this.enroll(customerId);
      if (!result.enrolled) return;
      enrollment = await this.enrollments.findOne({ where: { customerId, funnelId: funnel.id } });
    }
    if (!enrollment || enrollment.status !== 'ACTIVE') return;

    const settled = await this.settledOrders(customerId);
    const last = settled[0]?.createdAt ?? null;
    const stage = resolveStage({
      channel,
      customerStatus: customer.status,
      settledOrderCount: settled.length,
      daysSinceLastSettledOrder: last ? daysBetween(last, new Date()) : (enrollment.enrolledAt ? daysBetween(enrollment.enrolledAt, new Date()) : null),
      dormantAfterDays: channel === 'RETAIL' ? 30 : 45,
      current: enrollment.currentStepCode,
    });
    if (enrollment.currentStepCode !== stage) {
      enrollment.currentStepCode = stage;
      await this.enrollments.save(enrollment);
    }

    const scenario = this.pickScenario(channel, stage, {
      orderCount: settled.length,
      daysSinceEnroll: daysBetween(enrollment.enrolledAt, new Date()),
      customerStatus: customer.status,
    });
    if (!scenario) return;
    if ((ALWAYS_OFF_SCENARIOS as readonly string[]).includes(scenario.code)) return;

    const settings = await this.getSettings();
    const scenarioMode = effectiveMode(settings.mode, settings.scenarioModes[scenario.code]);
    if (scenarioMode === 'OFF' || !settings.enabled) {
      enrollment.nextRunAt = new Date(Date.now() + 6 * 3600_000);
      await this.enrollments.save(enrollment);
      return;
    }
    if (scenario.medium === 'CALL') {
      enrollment.nextActionType = 'CALL';
      enrollment.nextRunAt = enrollment.nextRunAt && enrollment.nextRunAt > new Date()
        ? enrollment.nextRunAt
        : new Date();
      await this.enrollments.save(enrollment);
      return;
    }

    await this.queueScenarioSms(customer, enrollment, scenario.code, scenarioMode, `auto:${scenario.code}:${customer.id}`);
    enrollment.nextActionType = 'NONE';
    enrollment.nextRunAt = new Date(Date.now() + 12 * 3600_000);
    await this.enrollments.save(enrollment);
  }

  async evaluateDue(limit = 40) {
    const due = await this.enrollments.find({
      where: { status: 'ACTIVE' },
      order: { nextRunAt: 'ASC' },
      take: limit,
    });
    const now = Date.now();
    for (const row of due) {
      if (row.nextRunAt && row.nextRunAt.getTime() > now) continue;
      try {
        await this.evaluateCustomer(row.customerId);
      } catch {
        /* keep going */
      }
    }
  }

  async board(channel: MarketingChannel) {
    const rows: Array<{ stage: string; count: string }> = await this.enrollments.query(
      `SELECT e."currentStepCode" AS stage, COUNT(*)::int AS count
       FROM marketing_enrollments e
       JOIN marketing_funnels f ON f.id::text = e."funnelId"
       WHERE f.channel = $1 AND e.status = 'ACTIVE'
       GROUP BY e."currentStepCode"`,
      [channel],
    );
    const settings = await this.getSettings();
    return {
      channel,
      stages: rows.map((r) => ({ stage: r.stage || 'UNKNOWN', count: Number(r.count) })),
      settings: { enabled: settings.enabled, mode: settings.mode },
    };
  }

  async queue(channel?: MarketingChannel) {
    const params: string[] = [];
    const channelSql = channel ? (params.push(channel), 'AND f.channel = $1') : '';
    const callDue: Array<Record<string, unknown>> = await this.enrollments.query(
      `SELECT e."customerId", c."ownerName", c."businessName", c.phone, c.status, c.type,
              e."currentStepCode" AS stage, e."nextActionType", e."nextRunAt", f.channel
       FROM marketing_enrollments e
       JOIN customers c ON c.id = e."customerId" AND c."deletedAt" IS NULL
       JOIN marketing_funnels f ON f.id::text = e."funnelId"
       WHERE e.status = 'ACTIVE' AND e."nextActionType" = 'CALL'
         AND (e."nextRunAt" IS NULL OR e."nextRunAt" <= NOW())
         ${channelSql}
       ORDER BY e."nextRunAt" ASC NULLS FIRST
       LIMIT 40`,
      params,
    );
    const pendingWs: Array<Record<string, unknown>> = await this.customers.query(
      `SELECT c.id AS "customerId", c."ownerName", c."businessName", c.phone, c.status, c.type,
              'APPLIED' AS stage, 'CALL' AS "nextActionType", c."createdAt" AS "nextRunAt", 'WHOLESALE' AS channel
       FROM customers c
       WHERE c."deletedAt" IS NULL AND c.status = 'PENDING'
         AND UPPER(COALESCE(c.type, '')) NOT IN ('RETAIL', 'B2C')
         ${channel && channel !== 'WHOLESALE' ? 'AND FALSE' : ''}
       ORDER BY c."createdAt" ASC
       LIMIT 20`,
    );
    const retailIdle: Array<Record<string, unknown>> = await this.enrollments.query(
      `SELECT e."customerId", c."ownerName", c."businessName", c.phone, c.status, c.type,
              e."currentStepCode" AS stage, e."nextActionType", e."nextRunAt", 'RETAIL' AS channel
       FROM marketing_enrollments e
       JOIN customers c ON c.id = e."customerId" AND c."deletedAt" IS NULL
       JOIN marketing_funnels f ON f.id::text = e."funnelId" AND f.channel = 'RETAIL'
       WHERE e.status = 'ACTIVE' AND e."currentStepCode" = 'REGISTERED'
         AND NOT EXISTS (
           SELECT 1 FROM orders o
           WHERE o."customerId" = c.id AND o."deletedAt" IS NULL
             AND o.status IN ('CONFIRMED','PROCESSING','SHIPPED','DELIVERED','COMPLETED')
         )
         ${channel && channel !== 'RETAIL' ? 'AND FALSE' : ''}
       ORDER BY e."enrolledAt" ASC
       LIMIT 20`,
    );
    const seen = new Set<string>();
    const items = [...callDue, ...pendingWs, ...retailIdle].filter((row) => {
      const id = String(row.customerId);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return { items };
  }

  async dossier(customerId: string) {
    const customer = await this.customers.findOne({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');
    const channel = this.channelOf(customer);
    const [consent, suppression, enrollment, timeline, recentOrders, tpls, settings] = await Promise.all([
      this.consents.findOne({ where: { customerId, channel } }),
      this.suppressions.findOne({ where: { phoneNormalized: normalizePhone(customer.phone) } }),
      this.enrollments.findOne({ where: { customerId } }),
      this.activities.find({ where: { customerId }, order: { occurredAt: 'DESC' }, take: 40 }),
      this.orders.find({
        where: { customerId },
        order: { createdAt: 'DESC' },
        take: 8,
      }),
      this.templates.find({ where: { channel, isActive: true }, order: { code: 'ASC' } }),
      this.getSettings(),
    ]);
    return {
      customer: {
        id: customer.id,
        code: customer.code,
        businessName: customer.businessName,
        ownerName: customer.ownerName,
        phone: customer.phone,
        city: customer.city,
        province: customer.province,
        status: customer.status,
        type: customer.type,
        channel,
        assignedAgentId: customer.assignedAgentId,
      },
      consent: consent ? { status: consent.status, source: consent.source, updatedAt: consent.updatedAt } : null,
      suppressed: !!suppression,
      enrollment: enrollment ? {
        id: enrollment.id,
        status: enrollment.status,
        stage: enrollment.currentStepCode,
        nextActionType: enrollment.nextActionType,
        nextRunAt: enrollment.nextRunAt,
        enrolledAt: enrollment.enrolledAt,
      } : null,
      timeline: timeline.map((a) => ({
        id: a.id,
        type: a.type,
        payload: a.payload,
        occurredAt: a.occurredAt,
        actorUserId: a.actorUserId,
      })),
      orders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: o.total,
        createdAt: o.createdAt,
      })),
      templates: tpls.map((t) => ({
        id: t.id,
        code: t.code,
        title: t.title,
        medium: t.medium,
        messageClass: t.messageClass,
        body: t.body,
        callScript: t.callScript,
      })),
      settings: { enabled: settings.enabled, mode: settings.mode, quietStartHour: settings.quietStartHour, quietEndHour: settings.quietEndHour },
    };
  }

  async logCall(customerId: string, body: { result: string; notes?: string }, actor: Actor) {
    const customer = await this.requireCustomer(customerId);
    const result = String(body.result || '').toUpperCase();
    if (!(CALL_RESULTS as readonly string[]).includes(result)) {
      throw new BadRequestException('نتیجه تماس نامعتبر است');
    }
    const channel = this.channelOf(customer);
    await this.activity(customerId, channel, 'CALL', {
      result: result as CallResult,
      notes: String(body.notes || '').slice(0, 1000),
    }, actor.id);
    const enrollment = await this.enrollments.findOne({ where: { customerId } });
    if (enrollment && enrollment.nextActionType === 'CALL') {
      enrollment.nextActionType = result === 'CALLBACK' ? 'CALL' : 'NONE';
      enrollment.nextRunAt = result === 'CALLBACK' ? new Date(Date.now() + 3600_000) : new Date(Date.now() + 7 * 86400_000);
      await this.enrollments.save(enrollment);
    }
    return { ok: true };
  }

  async setStage(customerId: string, stage: string, reason: string, actor: Actor) {
    const customer = await this.requireCustomer(customerId);
    const enrollment = await this.enrollments.findOne({ where: { customerId } });
    if (!enrollment) throw new BadRequestException('قیف برای این مشتری ساخته نشده');
    enrollment.currentStepCode = String(stage || '').slice(0, 64);
    await this.enrollments.save(enrollment);
    await this.activity(customerId, this.channelOf(customer), 'ENROLL', {
      stage: enrollment.currentStepCode,
      reason: String(reason || '').slice(0, 200),
      manual: true,
    }, actor.id);
    return { stage: enrollment.currentStepCode };
  }

  async optOut(customerId: string, actor: Actor) {
    const customer = await this.requireCustomer(customerId);
    const channel = this.channelOf(customer);
    await this.upsertConsent(customerId, channel, 'REVOKED', 'ADMIN_TOGGLE', actor.id);
    const phone = normalizePhone(customer.phone);
    if (phone) {
      const existing = await this.suppressions.findOne({ where: { phoneNormalized: phone } });
      if (!existing) {
        await this.suppressions.save(this.suppressions.create({
          phoneNormalized: phone,
          reason: 'admin_opt_out',
          createdByUserId: actor.id ?? null,
        }));
      }
    }
    await this.cancelPendingSends({ customerId, phone, reason: 'REVOKED' });
    await this.activity(customerId, channel, 'CONSENT', { status: 'REVOKED' }, actor.id);
    return { ok: true, status: 'REVOKED' };
  }

  async suppressDeletedCustomer(customer: CustomerEntity, actorId?: string) {
    const channel = this.channelOf(customer);
    await this.upsertConsent(customer.id, channel, 'REVOKED', 'ADMIN_TOGGLE', actorId);
    const phone = normalizePhone(customer.phone);
    if (phone) {
      const existing = await this.suppressions.findOne({ where: { phoneNormalized: phone } });
      if (!existing) {
        await this.suppressions.save(this.suppressions.create({
          phoneNormalized: phone,
          reason: 'customer_deleted',
          createdByUserId: actorId ?? null,
        }));
      }
    }
    await this.cancelPendingSends({ customerId: customer.id, phone, reason: 'CUSTOMER_DELETED' });
  }

  async optIn(customerId: string, actor: Actor) {
    this.assertAdmin(actor);
    const customer = await this.requireCustomer(customerId);
    const channel = this.channelOf(customer);
    await this.upsertConsent(customerId, channel, 'GRANTED', 'ADMIN_TOGGLE', actor.id);
    await this.suppressions.delete({ phoneNormalized: normalizePhone(customer.phone) });
    await this.activity(customerId, channel, 'CONSENT', { status: 'GRANTED' }, actor.id);
    return { ok: true, status: 'GRANTED' };
  }

  async previewOrSendSms(customerId: string, input: {
    templateCode?: string;
    body?: string;
    idempotencyKey?: string;
  }, actor: Actor) {
    const customer = await this.requireCustomer(customerId);
    const settings = await this.getSettings();
    if (settings.mode === 'LIVE') this.assertAdmin(actor);
    const channel = this.channelOf(customer);
    const tpl = input.templateCode
      ? await this.activeTemplate(channel, input.templateCode)
      : null;
    const vars = this.templateVars(customer);
    const body = fillTemplate(input.body || tpl?.body || '', vars);
    if (!body) throw new BadRequestException('TEMPLATE_MISSING: متن پیام خالی است');
    const messageClass: MessageClass = tpl?.messageClass || 'NURTURE';
    const mode = effectiveMode(settings.mode, input.templateCode ? settings.scenarioModes[input.templateCode] : settings.mode);
    if (mode === 'OFF' || !settings.enabled) {
      return { preview: true, body, status: 'PREVIEW', reason: settings.enabled ? 'MODE_OFF' : 'DISABLED' };
    }
    if (mode === 'PREVIEW') {
      return { preview: true, body, status: 'PREVIEW' };
    }
    const send = await this.queueSms({
      customer,
      channel,
      body,
      messageClass,
      template: tpl,
      mode,
      idempotencyKey: input.idempotencyKey || `manual:${customerId}:${input.templateCode || 'custom'}:${Date.now()}`,
      actorId: actor.id,
    });
    return send;
  }

  async listTemplates(channel?: MarketingChannel) {
    const where = channel ? { channel } : {};
    const rows = await this.templates.find({ where, order: { channel: 'ASC', code: 'ASC', version: 'DESC' } });
    return { data: rows };
  }

  async upsertTemplate(input: {
    id?: string;
    channel: MarketingChannel;
    code: string;
    title: string;
    body: string;
    callScript?: string;
    medium?: 'SMS' | 'CALL';
    messageClass?: MessageClass;
    isActive?: boolean;
  }) {
    if (input.messageClass && input.messageClass !== 'NURTURE' && input.messageClass !== 'PROMO') {
      throw new BadRequestException('کلاس پیام بازاریابی فقط NURTURE یا PROMO است');
    }
    if (input.id) {
      const row = await this.templates.findOne({ where: { id: input.id } });
      if (!row) throw new NotFoundException('قالب یافت نشد');
      row.title = input.title;
      row.body = input.body;
      row.callScript = input.callScript ?? row.callScript;
      row.isActive = input.isActive ?? row.isActive;
      if (input.messageClass) row.messageClass = input.messageClass;
      if (row.messageClass !== 'NURTURE' && row.messageClass !== 'PROMO') {
        row.messageClass = 'NURTURE';
      }
      return this.templates.save(row);
    }
    const latest = await this.templates.findOne({
      where: { channel: input.channel, code: input.code },
      order: { version: 'DESC' },
    });
    return this.templates.save(this.templates.create({
      channel: input.channel,
      code: input.code,
      version: (latest?.version ?? 0) + 1,
      title: input.title,
      body: input.body,
      callScript: input.callScript ?? null,
      medium: input.medium || 'SMS',
      messageClass: input.messageClass || 'NURTURE',
      isActive: input.isActive !== false,
    }));
  }

  async listAutomations() {
    const settings = await this.getSettings();
    const tpls = await this.templates.find({ where: { isActive: true }, order: { channel: 'ASC', code: 'ASC' } });
    return {
      global: { enabled: settings.enabled, mode: settings.mode },
      scenarios: tpls.map((t) => ({
        code: t.code,
        channel: t.channel,
        title: t.title,
        messageClass: t.messageClass,
        medium: t.medium,
        mode: (ALWAYS_OFF_SCENARIOS as readonly string[]).includes(t.code)
          ? 'OFF'
          : (settings.scenarioModes[t.code] || 'OFF'),
        lockedOff: (ALWAYS_OFF_SCENARIOS as readonly string[]).includes(t.code),
      })),
    };
  }

  async patchAutomation(code: string, mode: MarketingMode, actor: Actor) {
    if ((ALWAYS_OFF_SCENARIOS as readonly string[]).includes(code)) {
      throw new BadRequestException('این سناریو تا آماده شدن داده خاموش می‌ماند');
    }
    if (mode === 'LIVE') this.assertAdmin(actor);
    const settings = await this.getSettings();
    settings.scenarioModes[code] = mode;
    await this.settings.set(SETTINGS_KEY, settings);
    return { code, mode };
  }

  async canaryScenario(code: string, actor: Actor) {
    this.assertAdmin(actor);
    const tpl = await this.templates.findOne({ where: { code, isActive: true }, order: { version: 'DESC' } });
    if (!tpl) throw new NotFoundException('قالب یافت نشد');
    const settings = await this.getSettings();
    const phone = await this.canaryPhone(tpl.channel, settings);
    if (!phone) throw new BadRequestException('NO_PHONE: شماره آزمایشی کانال تنظیم نشده');
    const body = fillTemplate(tpl.body, { name: 'آزمایش', city: 'مشهد', orderNumber: '', productName: '' });
    const ok = await this.queueSms({
      customer: null,
      channel: tpl.channel,
      body,
      messageClass: tpl.messageClass,
      template: tpl,
      mode: 'CANARY',
      idempotencyKey: `canary:${code}:${Date.now()}`,
      actorId: actor.id,
      recipientOverride: phone,
    });
    return ok;
  }

  async listDispatches(channel?: MarketingChannel) {
    const where = channel ? { channel } : {};
    const rows = await this.sends.find({ where, order: { createdAt: 'DESC' }, take: 80 });
    return {
      data: rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        status: r.status,
        skipReason: r.skipReason,
        mode: r.mode,
        templateCode: r.templateCode,
        messageClass: r.messageClass,
        createdAt: r.createdAt,
        recipientActual: r.recipientActual ? `${r.recipientActual.slice(0, 4)}…` : null,
      })),
    };
  }

  async listCampaigns() {
    const rows = await this.campaigns.find({ order: { createdAt: 'DESC' }, take: 30 });
    return { data: rows };
  }

  async createCampaign(input: { channel: MarketingChannel; title: string; templateId?: string; messageClass?: MessageClass }, actor: Actor) {
    this.assertLiveRole(actor);
    if (input.messageClass && input.messageClass !== 'NURTURE' && input.messageClass !== 'PROMO') {
      throw new BadRequestException('کلاس پیام بازاریابی فقط NURTURE یا PROMO است');
    }
    return this.campaigns.save(this.campaigns.create({
      channel: input.channel,
      title: input.title,
      templateId: input.templateId ?? null,
      messageClass: input.messageClass === 'NURTURE' ? 'NURTURE' : 'PROMO',
      mode: 'OFF',
      filter: { grantedOnly: true },
      createdByUserId: actor.id ?? null,
    }));
  }

  async campaignCanary(id: string, actor: Actor) {
    this.assertAdmin(actor);
    const campaign = await this.campaigns.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('کمپین یافت نشد');
    const tpl = campaign.templateId
      ? await this.templates.findOne({ where: { id: campaign.templateId } })
      : null;
    if (!tpl) throw new BadRequestException('TEMPLATE_MISSING');
    const settings = await this.getSettings();
    const phone = await this.canaryPhone(campaign.channel, settings);
    if (!phone) throw new BadRequestException('NO_PHONE: شماره آزمایشی نیست');
    const body = fillTemplate(tpl.body, { name: 'آزمایش', city: 'مشهد', orderNumber: '', productName: '' });
    const result = await this.queueSms({
      customer: null,
      channel: campaign.channel,
      body,
      messageClass: campaign.messageClass,
      template: tpl,
      mode: 'CANARY',
      idempotencyKey: `campaign-canary:${campaign.id}:${Date.now()}`,
      actorId: actor.id,
      recipientOverride: phone,
      campaignId: campaign.id,
    });
    campaign.canaryAt = new Date();
    campaign.canarySucceeded = result.status === 'QUEUED' || result.status === 'SENT';
    await this.campaigns.save(campaign);
    return { campaign, result };
  }

  async goLiveCampaign(id: string, actor: Actor) {
    this.assertAdmin(actor);
    const settings = await this.getSettings();
    if (!settings.enabled || settings.mode !== 'LIVE') {
      throw new BadRequestException('MODE_OFF: ارسال زنده سراسری خاموش است');
    }
    const campaign = await this.campaigns.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('کمپین یافت نشد');
    if (!campaign.canarySucceeded) throw new BadRequestException('ابتدا آزمایش کاناری باید موفق شود');
    campaign.mode = 'LIVE';
    await this.campaigns.save(campaign);
    await this.outbox.enqueue({
      operationId: `mkt-cmp:${campaign.id}`,
      eventType: OUTBOX_EVENT_TYPES.MARKETING_CAMPAIGN_DISPATCH,
      aggregateType: 'marketing_campaign',
      aggregateId: campaign.id,
      channel: campaign.channel,
      payload: { campaignId: campaign.id },
    });
    return campaign;
  }

  async dispatchCampaign(campaignId: string) {
    const settings = await this.getSettings();
    if (!settings.enabled || settings.mode !== 'LIVE') return;
    const campaign = await this.campaigns.findOne({ where: { id: campaignId } });
    if (!campaign || campaign.mode !== 'LIVE') return;
    if (campaign.messageClass === 'PROMO') {
      const granted = await this.consents.find({ where: { channel: campaign.channel, status: 'GRANTED' } });
      const ids = granted.map((g) => g.customerId);
      if (!ids.length) return;
      const customers = await this.customers.find({ where: { id: In(ids) } });
      const tpl = campaign.templateId
        ? await this.templates.findOne({ where: { id: campaign.templateId } })
        : null;
      if (!tpl) return;
      let queued = 0;
      for (const customer of customers.slice(0, SMS_IR_BULK_MAX)) {
        const body = fillTemplate(tpl.body, this.templateVars(customer));
        await this.queueSms({
          customer,
          channel: campaign.channel,
          body,
          messageClass: campaign.messageClass,
          template: tpl,
          mode: 'LIVE',
          idempotencyKey: `campaign:${campaign.id}:${customer.id}`,
          campaignId: campaign.id,
        });
        queued += 1;
      }
      return { queued };
    }
  }

  async handleRegisteredEvent(customerId: string) {
    await this.evaluateCustomer(customerId);
  }

  async handleApprovedEvent(customerId: string) {
    const customer = await this.customers.findOne({ where: { id: customerId } });
    if (!customer) return;
    const enrollment = await this.enrollments.findOne({ where: { customerId } });
    if (enrollment) {
      enrollment.currentStepCode = 'APPROVED';
      enrollment.nextActionType = 'CALL';
      enrollment.nextRunAt = new Date(Date.now() + 86_400_000);
      await this.enrollments.save(enrollment);
    }
    await this.activity(customerId, 'WHOLESALE', 'ENROLL', { stage: 'APPROVED', skipSms: 'wholesaleApproved' }, null);
  }

  private pickScenario(channel: MarketingChannel, stage: string, ctx: {
    orderCount: number;
    daysSinceEnroll: number;
    customerStatus: string;
  }): { code: string; medium: 'SMS' | 'CALL' } | null {
    if (channel === 'RETAIL') {
      if (stage === 'REGISTERED' && ctx.orderCount === 0 && ctx.daysSinceEnroll <= 1) {
        return { code: 'retail.welcome.after_otp', medium: 'SMS' };
      }
      if ((stage === 'ACTIVE_BUYER' || stage === 'REPEAT') && ctx.daysSinceEnroll >= 14) {
        return { code: 'retail.care.14d', medium: 'SMS' };
      }
      if (stage === 'DORMANT') return { code: 'retail.winback.30d', medium: 'SMS' };
      return null;
    }
    if (stage === 'APPLIED' && ctx.daysSinceEnroll <= 1) return { code: 'wholesale.apply.received', medium: 'SMS' };
    if (stage === 'APPLIED' && ctx.customerStatus === 'PENDING' && ctx.daysSinceEnroll >= 3) {
      return { code: 'wholesale.apply.pending_wait', medium: 'SMS' };
    }
    if (stage === 'APPROVED' && ctx.orderCount === 0 && ctx.daysSinceEnroll >= 2) {
      return { code: 'wholesale.catalog.first_nudge', medium: 'SMS' };
    }
    if (stage === 'APPROVED' && ctx.orderCount === 0 && ctx.daysSinceEnroll >= 7) {
      return { code: 'wholesale.order.none_7d', medium: 'SMS' };
    }
    if (stage === 'DORMANT') return { code: 'wholesale.dormant.45d', medium: 'SMS' };
    return null;
  }

  private async queueScenarioSms(
    customer: CustomerEntity,
    enrollment: MarketingEnrollmentEntity,
    code: string,
    mode: MarketingMode,
    idempotencyKey: string,
  ) {
    const tpl = await this.activeTemplate(this.channelOf(customer), code);
    if (!tpl) return;
    const body = fillTemplate(tpl.body, this.templateVars(customer));
    await this.queueSms({
      customer,
      channel: this.channelOf(customer),
      body,
      messageClass: tpl.messageClass,
      template: tpl,
      mode,
      idempotencyKey,
      enrollmentId: enrollment.id,
    });
  }

  private async queueSms(input: {
    customer: CustomerEntity | null;
    channel: MarketingChannel;
    body: string;
    messageClass: MessageClass;
    template: MarketingTemplateEntity | null;
    mode: MarketingMode;
    idempotencyKey: string;
    actorId?: string;
    recipientOverride?: string;
    campaignId?: string;
    enrollmentId?: string;
  }) {
    const existing = await this.sends.findOne({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      return { preview: false, status: existing.status, sendId: existing.id, reason: existing.skipReason, body: existing.bodySnapshot };
    }
    const settings = await this.getSettings();
    const phone = input.recipientOverride
      || (input.customer ? normalizePhone(input.customer.phone) : '');
    const consent = input.customer
      ? await this.consents.findOne({ where: { customerId: input.customer.id, channel: input.channel } })
      : null;
    const suppressed = phone
      ? !!(await this.suppressions.findOne({ where: { phoneNormalized: phone } }))
      : false;
    const messageClass: MessageClass = input.messageClass === 'PROMO' ? 'PROMO' : 'NURTURE';
    const consentDecision = decideConsent({
      messageClass,
      consent: consent?.status ?? (input.recipientOverride ? 'GRANTED' : null),
      suppressed,
      treatRegisterAutoAsPromoConsent: settings.treatRegisterAutoAsPromoConsent,
    });
    if (!consentDecision.allow && 'reason' in consentDecision) {
      const skipReason = consentDecision.reason;
      const skipped = await this.sends.save(this.sends.create({
        customerId: input.customer?.id ?? null,
        channel: input.channel,
        phoneNormalized: phone,
        templateId: input.template?.id ?? null,
        templateCode: input.template?.code ?? null,
        messageClass,
        mode: input.mode,
        status: 'SUPPRESSED',
        skipReason,
        bodySnapshot: input.body,
        idempotencyKey: input.idempotencyKey,
        campaignId: input.campaignId ?? null,
        enrollmentId: input.enrollmentId ?? null,
      }));
      return { preview: false, status: skipped.status, sendId: skipped.id, reason: skipReason, body: input.body };
    }

    const dayStart = tehranDayStart(new Date());
    const sentToday = await this.sends
      .createQueryBuilder('s')
      .where('s.phoneNormalized = :phone', { phone })
      .andWhere('s.createdAt >= :dayStart', { dayStart })
      .andWhere('s.status IN (:...st)', { st: ['QUEUED', 'SENDING', 'SENT'] })
      .getMany();
    const channelSentToday = await this.sends
      .createQueryBuilder('s')
      .where('s.channel = :channel', { channel: input.channel })
      .andWhere('s.createdAt >= :dayStart', { dayStart })
      .andWhere('s.status IN (:...st)', { st: ['QUEUED', 'SENDING', 'SENT'] })
      .getCount();
    const lastPromo = sentToday.filter((s) => s.messageClass === 'PROMO').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const canaryPhone = input.recipientOverride || await this.canaryPhone(input.channel, settings);
    const gate = evaluateSendGate({
      enabled: settings.enabled,
      mode: input.mode,
      messageClass,
      now: new Date(),
      quietStartHour: settings.quietStartHour,
      quietEndHour: settings.quietEndHour,
      sentNurtureToday: sentToday.filter((s) => s.messageClass === 'NURTURE').length,
      sentPromoToday: sentToday.filter((s) => s.messageClass === 'PROMO').length,
      nurtureCap: settings.nurturePerPhonePerDay,
      promoCap: settings.promoPerPhonePerDay,
      lastPromoAt: lastPromo?.createdAt ?? null,
      promoMinGapHours: settings.promoMinGapHours,
      channelSentToday,
      dailyCapPerChannel: settings.dailyCapPerChannel,
      hasTemplate: !!input.body,
      hasPhone: !!phone,
      canaryPhone,
    });
    if (!gate.allow && 'reason' in gate) {
      const skipReason = gate.reason;
      const deferUntil = 'deferUntil' in gate ? gate.deferUntil : undefined;
      const skipped = await this.sends.save(this.sends.create({
        customerId: input.customer?.id ?? null,
        channel: input.channel,
        phoneNormalized: phone,
        templateId: input.template?.id ?? null,
        templateCode: input.template?.code ?? null,
        messageClass,
        mode: input.mode,
        status: 'SKIPPED',
        skipReason,
        bodySnapshot: input.body,
        idempotencyKey: input.idempotencyKey,
        campaignId: input.campaignId ?? null,
        enrollmentId: input.enrollmentId ?? null,
      }));
      if (skipReason === 'QUIET_HOURS' && deferUntil) {
        await this.outbox.enqueue({
          operationId: `mkt-snd:${skipped.id}`,
          eventType: OUTBOX_EVENT_TYPES.MARKETING_SEND_REQUESTED,
          aggregateType: 'marketing_send',
          aggregateId: skipped.id,
          channel: input.channel,
          payload: { sendId: skipped.id },
          availableAt: deferUntil,
        });
        skipped.status = 'QUEUED';
        skipped.skipReason = 'QUIET_HOURS';
        await this.sends.save(skipped);
      }
      return { preview: skipReason === 'PREVIEW', status: skipped.status, sendId: skipped.id, reason: skipReason, body: input.body };
    }

    const recipient = gate.recipientOverride || phone;
    const row = await this.sends.save(this.sends.create({
      customerId: input.customer?.id ?? null,
      channel: input.channel,
      phoneNormalized: phone,
      templateId: input.template?.id ?? null,
      templateCode: input.template?.code ?? null,
      messageClass,
      mode: input.mode,
      status: 'QUEUED',
      bodySnapshot: input.body,
      idempotencyKey: input.idempotencyKey,
      recipientActual: recipient,
      campaignId: input.campaignId ?? null,
      enrollmentId: input.enrollmentId ?? null,
    }));
    const queued = await this.outbox.enqueue({
      operationId: `mkt-snd:${row.id}`,
      eventType: OUTBOX_EVENT_TYPES.MARKETING_SEND_REQUESTED,
      aggregateType: 'marketing_send',
      aggregateId: row.id,
      channel: input.channel,
      payload: { sendId: row.id },
    });
    row.outboxEventId = queued.id;
    await this.sends.save(row);
    if (input.customer) {
      await this.activity(input.customer.id, input.channel, 'SMS', {
        templateCode: input.template?.code,
        mode: input.mode,
        sendId: row.id,
      }, input.actorId);
    }
    return { preview: false, status: row.status, sendId: row.id, body: input.body };
  }

  private async cancelPendingSends(input: {
    customerId: string;
    phone?: string | null;
    reason: string;
  }) {
    const qb = this.sends
      .createQueryBuilder()
      .update()
      .set({ status: 'SUPPRESSED', skipReason: input.reason })
      .where('status IN (:...st)', { st: ['QUEUED', 'SENDING'] });
    if (input.phone) {
      qb.andWhere('(customerId = :customerId OR phoneNormalized = :phone)', {
        customerId: input.customerId,
        phone: input.phone,
      });
    } else {
      qb.andWhere('customerId = :customerId', { customerId: input.customerId });
    }
    await qb.execute();
  }

  private async shouldSkipEnroll(customer: CustomerEntity): Promise<boolean> {
    const linked = await this.users.findOne({ where: { customerId: customer.id } });
    if (linked && isStaffRole(linked.role)) return true;
    const notes = customer.notes || '';
    if (notes.includes('حساب مشتری جدا از نقش مدیریت')) return true;
    const sms = await this.settings.sms();
    const adminPhones = [
      sms.adminPhoneRetail, sms.adminPhoneRetail2, sms.adminPhoneWholesale, sms.adminPhoneWholesale2,
    ].map((p) => normalizePhone(String(p || ''))).filter(Boolean);
    return adminPhones.includes(normalizePhone(customer.phone));
  }

  private async upsertConsent(
    customerId: string,
    channel: MarketingChannel,
    status: 'REGISTER_AUTO' | 'GRANTED' | 'REVOKED',
    source: ConsentSource,
    actorId?: string,
  ) {
    const existing = await this.consents.findOne({ where: { customerId, channel } });
    if (existing) {
      if (existing.status === 'GRANTED' && status === 'REGISTER_AUTO') return existing;
      if (existing.status === 'REVOKED' && status === 'REGISTER_AUTO') return existing;
      existing.status = status;
      existing.source = source;
      existing.updatedByUserId = actorId ?? null;
      return this.consents.save(existing);
    }
    return this.consents.save(this.consents.create({
      customerId,
      channel,
      status,
      source,
      updatedByUserId: actorId ?? null,
    }));
  }

  private async activity(
    customerId: string,
    channel: MarketingChannel,
    type: 'SMS' | 'CALL' | 'CONSENT' | 'ENROLL',
    payload: Record<string, unknown>,
    actorUserId?: string | null,
  ) {
    await this.activities.save(this.activities.create({
      customerId,
      channel,
      type,
      payload,
      actorUserId: actorUserId ?? null,
      occurredAt: new Date(),
    }));
  }

  private async settledOrders(customerId: string) {
    const rows = await this.orders.find({ where: { customerId }, order: { createdAt: 'DESC' } });
    return rows.filter((o) => isSettledOrderStatus(o.status));
  }

  private async activeTemplate(channel: MarketingChannel, code: string) {
    return this.templates.findOne({
      where: { channel, code, isActive: true },
      order: { version: 'DESC' },
    });
  }

  private templateVars(customer: CustomerEntity) {
    return {
      name: customer.ownerName || customer.businessName || '',
      city: customer.city || '',
      orderNumber: '',
      productName: '',
    };
  }

  private async canaryPhone(channel: MarketingChannel, settings = DEFAULT_MARKETING_SETTINGS) {
    const fromSettings = channel === 'RETAIL' ? settings.canaryPhoneRetail : settings.canaryPhoneWholesale;
    if (fromSettings) return normalizePhone(fromSettings);
    const sms = await this.settings.sms();
    const fallback = channel === 'RETAIL' ? sms.adminPhoneRetail : sms.adminPhoneWholesale;
    return fallback ? normalizePhone(fallback) : '';
  }

  private async requireCustomer(id: string) {
    const customer = await this.customers.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');
    return customer;
  }

  private assertAdmin(actor: Actor) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('فقط مدیر کل این عمل را دارد');
  }

  private assertLiveRole(actor: Actor) {
    if (actor.role !== 'ADMIN' && actor.role !== 'SALES_MANAGER') {
      throw new ForbiddenException('ارسال زنده فقط مدیر کل یا مدیر فروش');
    }
  }
}

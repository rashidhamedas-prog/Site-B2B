import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomInt } from 'crypto';
import { In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { UserEntity } from '../auth/entities/user.entity';
import { SettingsService } from '../settings/settings.service';
import { MarketingConsentEntity } from '../customer-marketing/entities/marketing-consent.entity';
import { MarketingSuppressionEntity } from '../customer-marketing/entities/marketing-suppression.entity';
import { NotificationService } from '../notification/notification.service';
import { SMS_RETRY_MAX_ATTEMPTS, backoffDelayMs } from './domain/backoff';
import { parseInboundIntent } from './domain/inbound';
import { countSmsParts } from './domain/parts';
import { maskMobile, normalizeIranMobileStrict } from './domain/phone';
import {
  isOfficialPromoWindow,
  isWithinPromoWindow,
  nextPromoWindowOpen,
} from './domain/quiet-hours';
import {
  ensureOptOutFooter,
  fillTemplateStrict,
  type SmsMessageClass,
} from './domain/template';
import {
  SmsAuditLogEntity,
  SmsBlacklistEntity,
  SmsCampaignEntity,
  SmsCampaignRecipientEntity,
  SmsConfirmationEntity,
  SmsContactListEntity,
  SmsContactListMemberEntity,
  SmsCreditSnapshotEntity,
  SmsInboundEntity,
  SmsMessageEntity,
  SmsTemplateEntity,
  SmsUnsubscribeEntity,
} from './entities/sms-panel.entities';
import { lineForMessageClass } from './provider/secrets';
import { SmsProviderService } from './provider/sms-provider.service';
import { SMS_MESSAGE_CLASSES } from './sms-panel.dto';
import { SmsPanelRateLimit } from './sms-panel.rate-limit';
import { availableCreditFrom, CREDIT_RESERVE_STATUSES } from './sms-panel.credit';
import {
  canCancelCampaign,
  canConfirmCampaign,
  canPauseCampaign,
  canResumeCampaign,
} from './sms-panel.fsm';
import {
  hashSmsToken,
  isValidCampaignOtpLength,
  normalizeCampaignOtp,
  otpHashMatches,
} from './sms-panel.otp-logic';
import {
  blocksDispatchResend,
  checkFourEyesApproval,
  checkSendSingleAllowed,
} from './sms-panel.policy';
import { confirmationTokenActive } from './sms-panel.token-logic';
import {
  DEFAULT_SMS_PANEL_SETTINGS,
  SMS_PANEL_SETTINGS_KEY,
  promoWindowFromSettings,
  resolveSmsPanelSettings,
  type SmsPanelSettings,
} from './sms-panel.settings';
import { SMS_MANAGERS } from './sms-roles';
import { AudienceService } from './audience/audience.service';

function hashToken(raw: string): string {
  return hashSmsToken(raw);
}

function payloadHash(parts: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

function isSmsMessageClass(v: string): v is SmsMessageClass {
  return (SMS_MESSAGE_CLASSES as readonly string[]).includes(v);
}

function tehranDayStart(now = new Date()): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now);
  return new Date(`${ymd}T00:00:00+03:30`);
}

@Injectable()
export class SmsPanelService {
  private readonly logger = new Logger(SmsPanelService.name);
  private creditCache: { amount: number; at: number } | null = null;

  constructor(
    private readonly settings: SettingsService,
    private readonly providerSvc: SmsProviderService,
    private readonly notifications: NotificationService,
    private readonly rateLimit: SmsPanelRateLimit,
    @InjectRepository(SmsTemplateEntity) private readonly templates: Repository<SmsTemplateEntity>,
    @InjectRepository(SmsContactListEntity) private readonly lists: Repository<SmsContactListEntity>,
    @InjectRepository(SmsContactListMemberEntity)
    private readonly members: Repository<SmsContactListMemberEntity>,
    @InjectRepository(SmsCampaignEntity) private readonly campaigns: Repository<SmsCampaignEntity>,
    @InjectRepository(SmsCampaignRecipientEntity)
    private readonly campaignRecipients: Repository<SmsCampaignRecipientEntity>,
    @InjectRepository(SmsConfirmationEntity)
    private readonly confirmations: Repository<SmsConfirmationEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(SmsMessageEntity) private readonly messages: Repository<SmsMessageEntity>,
    @InjectRepository(SmsUnsubscribeEntity)
    private readonly unsubscribes: Repository<SmsUnsubscribeEntity>,
    @InjectRepository(SmsBlacklistEntity) private readonly blacklist: Repository<SmsBlacklistEntity>,
    @InjectRepository(SmsInboundEntity) private readonly inbound: Repository<SmsInboundEntity>,
    @InjectRepository(SmsAuditLogEntity) private readonly audit: Repository<SmsAuditLogEntity>,
    @InjectRepository(SmsCreditSnapshotEntity)
    private readonly creditSnaps: Repository<SmsCreditSnapshotEntity>,
    @InjectRepository(MarketingConsentEntity)
    private readonly consents: Repository<MarketingConsentEntity>,
    @InjectRepository(MarketingSuppressionEntity)
    private readonly suppressions: Repository<MarketingSuppressionEntity>,
    private readonly audience: AudienceService,
  ) {}

  async auditLog(input: {
    actorId?: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    meta?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }) {
    const meta = { ...(input.meta || {}) };
    if (typeof meta.phone === 'string') meta.phone = maskMobile(meta.phone);
    await this.audit.save(
      this.audit.create({
        actorId: input.actorId || null,
        action: input.action,
        targetType: input.targetType || null,
        targetId: input.targetId || null,
        meta,
        ip: input.ip || null,
        userAgent: input.userAgent || null,
        at: new Date(),
      }),
    );
  }

  async getPanelSettings(): Promise<SmsPanelSettings> {
    const stored = await this.settings.get(SMS_PANEL_SETTINGS_KEY);
    return resolveSmsPanelSettings(stored);
  }

  async patchPanelSettings(
    actorId: string,
    patch: Partial<SmsPanelSettings>,
    ip?: string,
  ): Promise<SmsPanelSettings> {
    const cur = await this.getPanelSettings();
    const next = resolveSmsPanelSettings({ ...cur, ...patch });
    await this.settings.set(SMS_PANEL_SETTINGS_KEY, next as unknown as Record<string, any>);
    await this.auditLog({
      actorId,
      action: 'settings.update',
      targetType: 'settings',
      targetId: SMS_PANEL_SETTINGS_KEY,
      meta: { before: cur, after: next },
      ip,
    });
    return next;
  }

  async settingsPublicView(s: SmsPanelSettings) {
    const window = promoWindowFromSettings(s);
    const keys = await this.providerSvc.secretsStatus();
    return {
      ...s,
      officialWindow: isOfficialPromoWindow(window),
      officialWindowWarning: isOfficialPromoWindow(window)
        ? null
        : 'این بازه رسماً تأییدنشده است',
      provider: keys.provider,
      keys,
    };
  }

  listAudienceSources() {
    return this.audience.sources();
  }

  searchAudienceContacts(input: {
    q?: string;
    source?: string;
    page?: number;
    pageSize?: number;
    role?: string;
  }) {
    return this.audience.search(input);
  }

  getAudienceContact(phone: string, role?: string) {
    return this.audience.getByPhone(phone, role);
  }

  async getCredit(force = false) {
    const now = Date.now();
    if (!force && this.creditCache && now - this.creditCache.at < 60_000) {
      return { amount: this.creditCache.amount, unit: 'SMS' as const, cached: true };
    }
    const provider = this.providerSvc.get();
    const credit = await provider.getCredit();
    const amount = Math.max(0, Math.floor(credit.amount));
    this.creditCache = { amount, at: now };
    await this.creditSnaps.save(this.creditSnaps.create({ amount, unit: 'SMS', at: new Date() }));
    return { amount, unit: 'SMS' as const, cached: false };
  }

  /** Provider credit minus parts reserved for in-flight messages. */
  async availableCredit(force = false): Promise<number> {
    const credit = await this.getCredit(force);
    const raw = await this.messages
      .createQueryBuilder('m')
      .select('COALESCE(SUM(m.parts), 0)', 'sum')
      .where('m.status IN (:...st)', { st: [...CREDIT_RESERVE_STATUSES] })
      .getRawOne<{ sum: string }>();
    const reserved = Math.max(0, Number(raw?.sum || 0));
    return availableCreditFrom(credit.amount, reserved);
  }

  private campaignPayloadHash(campaign: SmsCampaignEntity): string {
    return payloadHash({
      campaignId: campaign.id,
      audienceSnapshotHash: campaign.audienceSnapshotHash,
      body: campaign.bodySnapshot,
      scheduledAt: campaign.scheduledAt?.toISOString() || null,
    });
  }

  private async isTestNumber(phone: string): Promise<boolean> {
    const panel = await this.getPanelSettings();
    return panel.testNumbers.some((n) => normalizeIranMobileStrict(n) === phone);
  }

  private async isBlacklisted(phone: string, messageClass: SmsMessageClass): Promise<boolean> {
    const row = await this.blacklist.findOne({ where: { phoneNormalized: phone } });
    if (!row) return false;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return false;
    if (row.scope === 'ALL') return true;
    return row.scope === 'PROMO' && messageClass === 'PROMO';
  }

  private async assertNotBlacklisted(phone: string, messageClass: SmsMessageClass) {
    if (await this.isBlacklisted(phone, messageClass)) {
      throw new BadRequestException({
        message: 'این شماره در لیست سیاه است. ارسال ممکن نیست.',
        code: 'SMS_BLACKLISTED',
      });
    }
  }

  private async hasPromoConsent(customerId?: string | null): Promise<boolean> {
    if (!customerId) return false;
    const rows = await this.consents.find({ where: { customerId }, take: 10 });
    return rows.some((r) => String(r.status) === 'GRANTED');
  }

  private async assertNotUnsubscribed(phone: string, messageClass: SmsMessageClass) {
    if (messageClass === 'OTP') return;
    const unsub = await this.unsubscribes.findOne({ where: { phoneNormalized: phone } });
    if (unsub && !unsub.resubscribedAt) {
      throw new BadRequestException({
        message:
          'این مشترک با «لغو۱۱» انصراف داده است. فقط پیام‌های الزامی سفارش جاری مجاز است.',
        code: 'SMS_UNSUBSCRIBED',
      });
    }
    const suppressed = await this.suppressions.findOne({ where: { phoneNormalized: phone } });
    if (suppressed && messageClass === 'PROMO') {
      throw new BadRequestException({
        message:
          'این مشترک با «لغو۱۱» انصراف داده است. فقط پیام‌های الزامی سفارش جاری مجاز است.',
        code: 'SMS_UNSUBSCRIBED',
      });
    }
  }

  private async assertPromoConsent(phone: string, customerId?: string | null) {
    if (!(await this.hasPromoConsent(customerId))) {
      throw new ForbiddenException({
        message: 'برای پیام تبلیغاتی رضایت صریح لازم است.',
        code: 'SMS_NO_CONSENT',
      });
    }
  }

  async sendSingle(input: {
    actorId: string;
    actorRole: string;
    to: string;
    body?: string;
    templateId?: string;
    vars?: Record<string, string>;
    messageClass: SmsMessageClass;
    customerId?: string;
    ip?: string;
    /** Canary / configured test numbers — skip consent gates only. */
    consentExempt?: boolean;
  }) {
    const messageClass = String(input.messageClass || '');
    if (!isSmsMessageClass(messageClass)) {
      throw new BadRequestException({
        message: 'کلاس پیام نامعتبر است',
        code: 'SMS_INVALID_CLASS',
      });
    }

    const sendDeny = checkSendSingleAllowed(input.actorRole, messageClass, {
      templateId: input.templateId,
      body: input.body,
    });
    if (sendDeny?.kind === 'FORBIDDEN') {
      const msg =
        input.actorRole === 'SMS_MARKETER'
          ? 'بازاریاب فقط می‌تواند پیام تبلیغاتی ارسال کند'
          : input.actorRole === 'SMS_OPERATOR'
            ? 'اپراتور فقط پیام تراکنشی با قالب فعال می‌تواند ارسال کند'
            : 'ارسال OTP فقط برای مدیر پیامک و مدیر کل مجاز است';
      throw new ForbiddenException({ message: msg, code: sendDeny.code });
    }
    if (sendDeny?.kind === 'BAD_REQUEST') {
      const msg =
        sendDeny.code === 'SMS_TEMPLATE_REQUIRED'
          ? 'اپراتور باید از قالب فعال استفاده کند (بدون متن آزاد)'
          : 'OTP باید از مسیر قالب SMS.ir ارسال شود (متن آزاد مجاز نیست)';
      throw new BadRequestException({ message: msg, code: sendDeny.code });
    }

    const phone = normalizeIranMobileStrict(input.to);
    if (!phone) {
      throw new BadRequestException({
        message: 'شماره موبایل معتبر نیست. نمونه درست: ۰۹۱۲۱۲۳۴۵۶۷',
        code: 'SMS_INVALID_PHONE',
      });
    }

    const testNumber = await this.isTestNumber(phone);
    const consentExempt = input.consentExempt || testNumber;

    const panel = await this.getPanelSettings();
    const window = promoWindowFromSettings(panel);

    if (messageClass === 'PROMO') {
      if (!isWithinPromoWindow(new Date(), window)) {
        const next = nextPromoWindowOpen(new Date(), window);
        throw new HttpException(
          {
            message: `ارسال تبلیغاتی فقط ${panel.promoWindowStart} تا ${panel.promoWindowEnd} به وقت تهران مجاز است.`,
            code: 'SMS_QUIET_HOURS',
            nextWindowAt: next?.toISOString() || null,
          },
          422,
        );
      }
      if (!consentExempt) {
        await this.assertPromoConsent(phone, input.customerId);
      }
    }

    await this.assertNotBlacklisted(phone, messageClass);
    await this.assertNotUnsubscribed(phone, messageClass);

    let body = input.body || '';
    let templateKey: string | null = null;
    let otpProviderTemplateId: string | null = null;
    if (input.templateId) {
      const tpl = await this.templates.findOne({ where: { id: input.templateId, isActive: true } });
      if (!tpl) throw new NotFoundException({ message: 'قالب پیدا نشد', code: 'SMS_TEMPLATE_NOT_FOUND' });
      body = fillTemplateStrict(tpl.body, input.vars || {}, tpl.variables || undefined);
      templateKey = tpl.key;
      if (tpl.providerTemplateId) otpProviderTemplateId = tpl.providerTemplateId;
    } else if (messageClass === 'OTP') {
      const secrets = await this.providerSvc.resolvedSecrets();
      if (!secrets.otpTemplateId) {
        throw new BadRequestException({
          message: 'قالب OTP در تنظیمات پیکربندی نشده است',
          code: 'SMS_OTP_TEMPLATE_REQUIRED',
        });
      }
      otpProviderTemplateId = secrets.otpTemplateId;
      body = `OTP:${JSON.stringify(input.vars || {})}`;
    }

    // Rate / frequency counts only after consent/blacklist/unsubscribe gates pass.
    if (messageClass === 'OTP' && input.ip) {
      const ipHit = await this.rateLimit.hitOtpIp(input.ip);
      if (ipHit != null) {
        throw new HttpException(
          {
            message: `تعداد درخواست OTP زیاد است. ${ipHit} ثانیه دیگر تلاش کنید.`,
            code: 'SMS_RATE_LIMITED',
            retryAfter: ipHit,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const otpPhone = await this.rateLimit.hitOtpPhone(phone);
      if (!otpPhone.ok) {
        throw new HttpException(
          {
            message: 'محدودیت ارسال OTP برای این شماره',
            code: otpPhone.code || 'SMS_RATE_LIMITED',
            retryAfter: otpPhone.retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    if (messageClass === 'PROMO' && !consentExempt) {
      const cap = await this.rateLimit.promoCaps(phone, panel.promoPerDay, panel.promoPerWeek);
      if (cap) {
        throw new HttpException(
          {
            message: `سقف پیام تبلیغاتی (${cap === 'DAY' ? 'روزانه' : 'هفتگی'}) برای این شماره پر شده است`,
            code: 'SMS_FREQUENCY_CAP',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    body = ensureOptOutFooter(body, messageClass);
    const parts = countSmsParts(body);

    const available = await this.availableCredit();
    if (parts > available) {
      throw new HttpException(
        {
          message: `اعتبار ناکافی است (نیاز به ${parts} پیامک، موجود ${available}).`,
          code: 'SMS_INSUFFICIENT_CREDIT',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const retry = await this.rateLimit.hitActorSend(input.actorId, 10, 60);
    if (retry != null) {
      throw new HttpException(
        {
          message: `تعداد درخواست‌ها زیاد است. لطفاً ${retry} ثانیه دیگر تلاش کنید.`,
          code: 'SMS_RATE_LIMITED',
          retryAfter: retry,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const idempotencyKey = `single:${input.actorId}:${phone}:${hashToken(body).slice(0, 12)}:${Date.now()}`;
    const row = await this.messages.save(
      this.messages.create({
        campaignId: null,
        templateKey: otpProviderTemplateId || templateKey,
        messageClass,
        phoneNormalized: phone,
        customerId: input.customerId || null,
        body,
        parts,
        status: 'QUEUED',
        attempts: 0,
        nextAttemptAt: new Date(),
        idempotencyKey,
        provider: this.providerSvc.get().id,
      }),
    );

    const result = await this.dispatchMessage(row);
    await this.auditLog({
      actorId: input.actorId,
      action: 'send.single',
      targetType: 'message',
      targetId: row.id,
      meta: { phone, messageClass: input.messageClass, status: result.status },
      ip: input.ip,
    });
    return {
      id: row.id,
      status: result.status,
      providerMessageId: result.providerMessageId,
      parts,
      phoneMasked: maskMobile(phone),
    };
  }

  async dispatchMessage(row: SmsMessageEntity): Promise<SmsMessageEntity> {
    if (blocksDispatchResend(row.status)) {
      // Never blind-resend; try delivery lookup if we have an id
      if (row.providerMessageId) {
        const reports = await this.providerSvc.get().getDeliveryStatus([row.providerMessageId]);
        const st = reports[0]?.state;
        if (st === 'DELIVERED') {
          row.status = 'DELIVERED';
          row.deliveryState = 'DELIVERED';
          row.deliveredAt = new Date();
          return this.messages.save(row);
        }
        if (st === 'UNDELIVERED' || st === 'FAILED') {
          row.status = 'UNDELIVERED';
          row.deliveryState = st;
          return this.messages.save(row);
        }
      }
      return row;
    }

    const claim = await this.messages
      .createQueryBuilder()
      .update(SmsMessageEntity)
      .set({ status: 'SENDING', attempts: () => '"attempts" + 1' })
      .where('id = :id AND status IN (:...st)', {
        id: row.id,
        st: ['QUEUED', 'SENDING'],
      })
      .execute();
    if (!claim.affected) return row;

    const fresh = await this.messages.findOneByOrFail({ id: row.id });
    const messageClass = fresh.messageClass as SmsMessageClass;
    const testNumber = await this.isTestNumber(fresh.phoneNormalized);

    if (await this.isBlacklisted(fresh.phoneNormalized, messageClass)) {
      fresh.status = 'SKIPPED';
      fresh.skipReason = 'BLACKLIST';
      await this.messages.save(fresh);
      if (fresh.campaignId) await this.maybeCompleteCampaign(fresh.campaignId);
      return fresh;
    }
    const unsub = await this.unsubscribes.findOne({
      where: { phoneNormalized: fresh.phoneNormalized },
    });
    if (unsub && !unsub.resubscribedAt && messageClass !== 'OTP') {
      fresh.status = 'SKIPPED';
      fresh.skipReason = 'UNSUBSCRIBED';
      await this.messages.save(fresh);
      if (fresh.campaignId) await this.maybeCompleteCampaign(fresh.campaignId);
      return fresh;
    }
    const suppressed = await this.suppressions.findOne({
      where: { phoneNormalized: fresh.phoneNormalized },
    });
    if (suppressed && messageClass === 'PROMO') {
      fresh.status = 'SKIPPED';
      fresh.skipReason = 'SUPPRESSED';
      await this.messages.save(fresh);
      if (fresh.campaignId) await this.maybeCompleteCampaign(fresh.campaignId);
      return fresh;
    }
    if (messageClass === 'PROMO' && !testNumber) {
      if (!(await this.hasPromoConsent(fresh.customerId))) {
        fresh.status = 'SKIPPED';
        fresh.skipReason = 'NO_CONSENT';
        await this.messages.save(fresh);
        if (fresh.campaignId) await this.maybeCompleteCampaign(fresh.campaignId);
        return fresh;
      }
      const panel = await this.getPanelSettings();
      const cap = await this.rateLimit.promoCaps(
        fresh.phoneNormalized,
        panel.promoPerDay,
        panel.promoPerWeek,
      );
      if (cap) {
        fresh.status = 'SKIPPED';
        fresh.skipReason = 'FREQUENCY_CAP';
        await this.messages.save(fresh);
        if (fresh.campaignId) await this.maybeCompleteCampaign(fresh.campaignId);
        return fresh;
      }
    }

    const secrets = await this.providerSvc.resolvedSecrets();
    const lineResolved = lineForMessageClass(messageClass, secrets);
    if ('error' in lineResolved) {
      fresh.status = 'FAILED';
      fresh.lastError = 'LINE_NOT_CONFIGURED';
      await this.messages.save(fresh);
      if (fresh.campaignId) await this.maybeCompleteCampaign(fresh.campaignId);
      return fresh;
    }

    if (!this.rateLimit.takeProviderToken()) {
      fresh.status = 'QUEUED';
      fresh.nextAttemptAt = new Date(Date.now() + 1000);
      fresh.lastError = 'PROVIDER_RATE_LIMIT';
      await this.messages.save(fresh);
      return fresh;
    }

    const available = await this.availableCredit(true);
    if (fresh.parts > available) {
      fresh.status = 'QUEUED';
      fresh.nextAttemptAt = new Date(Date.now() + 60_000);
      fresh.lastError = 'INSUFFICIENT_CREDIT';
      await this.messages.save(fresh);
      if (fresh.campaignId) {
        await this.campaigns.update({ id: fresh.campaignId }, { status: 'PAUSED' });
      }
      return fresh;
    }

    const provider = this.providerSvc.get();
    try {
      let result;
      if (messageClass === 'OTP' && fresh.templateKey) {
        let params: Record<string, string> = {};
        if (fresh.body.startsWith('OTP:')) {
          try {
            params = JSON.parse(fresh.body.slice(4)) as Record<string, string>;
          } catch {
            params = {};
          }
        }
        result = await provider.sendTemplate({
          to: fresh.phoneNormalized,
          templateId: fresh.templateKey,
          params,
        });
      } else {
        result = await provider.sendSingle({
          to: fresh.phoneNormalized,
          body: fresh.body,
          line: lineResolved.line,
          idempotencyKey: fresh.idempotencyKey,
        });
      }
      if (result.ok) {
        fresh.status = 'SENT';
        fresh.providerMessageId = result.providerMessageId || null;
        fresh.packId = result.packId || null;
        fresh.cost = result.cost ?? fresh.parts;
        fresh.lastError = null;
        const saved = await this.messages.save(fresh);
        if (fresh.campaignId) await this.maybeCompleteCampaign(fresh.campaignId);
        return saved;
      }
      if (result.error?.ambiguous) {
        fresh.status = 'PENDING_UNKNOWN';
        fresh.lastError = result.error.message;
        const saved = await this.messages.save(fresh);
        if (fresh.campaignId) await this.maybeCompleteCampaign(fresh.campaignId);
        return saved;
      }
      if (result.error?.code === 'BLACKLISTED') {
        fresh.status = 'SKIPPED';
        fresh.skipReason = 'PROVIDER_BLACKLIST';
        await this.blacklist.save(
          this.blacklist.create({
            phoneNormalized: fresh.phoneNormalized,
            scope: 'ALL',
            reason: 'PROVIDER_BLACKLIST',
            createdBy: null,
          }),
        );
        const saved = await this.messages.save(fresh);
        if (fresh.campaignId) await this.maybeCompleteCampaign(fresh.campaignId);
        return saved;
      }
      if (result.error?.retryable && fresh.attempts < SMS_RETRY_MAX_ATTEMPTS) {
        fresh.status = 'QUEUED';
        fresh.nextAttemptAt = new Date(
          Date.now() + backoffDelayMs(fresh.attempts, { random: () => 0.5 }),
        );
        fresh.lastError = result.error.message;
        return this.messages.save(fresh);
      }
      fresh.status = 'FAILED';
      fresh.lastError = result.error?.message || 'FAILED';
      const failed = await this.messages.save(fresh);
      if (fresh.campaignId) await this.maybeCompleteCampaign(fresh.campaignId);
      return failed;
    } catch (err: any) {
      fresh.status = 'QUEUED';
      fresh.nextAttemptAt = new Date(Date.now() + backoffDelayMs(fresh.attempts));
      fresh.lastError = String(err?.message || err);
      if (fresh.attempts >= SMS_RETRY_MAX_ATTEMPTS) {
        fresh.status = 'FAILED';
      }
      const saved = await this.messages.save(fresh);
      if (fresh.campaignId) await this.maybeCompleteCampaign(fresh.campaignId);
      return saved;
    }
  }

  private async maybeCompleteCampaign(campaignId: string) {
    const pending = await this.messages.count({
      where: { campaignId, status: In(['QUEUED', 'SENDING', 'PAUSED']) },
    });
    if (pending === 0) {
      await this.campaigns.update({ id: campaignId }, { status: 'COMPLETED' });
    }
  }

  async processQueue(limit = 20): Promise<number> {
    const due = await this.messages.find({
      where: {
        status: In(['QUEUED']),
        nextAttemptAt: LessThanOrEqual(new Date()),
      },
      order: { nextAttemptAt: 'ASC' },
      take: limit,
    });
    // also rows with null nextAttemptAt
    const dueNull = await this.messages.find({
      where: { status: 'QUEUED', nextAttemptAt: IsNull() },
      take: Math.max(0, limit - due.length),
    });
    let n = 0;
    for (const row of [...due, ...dueNull]) {
      const panel = await this.getPanelSettings();
      if (
        row.messageClass === 'PROMO' &&
        !isWithinPromoWindow(new Date(), promoWindowFromSettings(panel))
      ) {
        row.nextAttemptAt = nextPromoWindowOpen(new Date(), promoWindowFromSettings(panel));
        await this.messages.save(row);
        continue;
      }
      await this.dispatchMessage(row);
      n += 1;
    }
    return n;
  }

  // ----- templates -----
  listTemplates() {
    return this.templates.find({ order: { key: 'ASC' } });
  }

  async createTemplate(actorId: string, dto: Partial<SmsTemplateEntity>) {
    const row = await this.templates.save(
      this.templates.create({
        key: String(dto.key),
        name: String(dto.name),
        messageClass: String(dto.messageClass || 'TRANSACTIONAL'),
        body: String(dto.body || ''),
        variables: (dto.variables as string[]) || [],
        providerTemplateId: dto.providerTemplateId || null,
        version: 1,
        isActive: dto.isActive !== false,
        createdBy: actorId,
      }),
    );
    await this.auditLog({
      actorId,
      action: 'template.create',
      targetType: 'template',
      targetId: row.id,
    });
    return row;
  }

  async updateTemplate(actorId: string, id: string, dto: Partial<SmsTemplateEntity>) {
    const row = await this.templates.findOneByOrFail({ id });
    const next = this.templates.create({
      ...row,
      id: undefined as any,
      key: row.key,
      name: dto.name ?? row.name,
      messageClass: dto.messageClass ?? row.messageClass,
      body: dto.body ?? row.body,
      variables: (dto.variables as string[]) ?? row.variables,
      providerTemplateId: dto.providerTemplateId ?? row.providerTemplateId,
      version: row.version + 1,
      isActive: dto.isActive ?? row.isActive,
      createdBy: actorId,
    });
    // version bump: update in place
    row.name = next.name;
    row.messageClass = next.messageClass;
    row.body = next.body;
    row.variables = next.variables;
    row.providerTemplateId = next.providerTemplateId;
    row.version = next.version;
    row.isActive = next.isActive;
    await this.templates.save(row);
    await this.auditLog({
      actorId,
      action: 'template.update',
      targetType: 'template',
      targetId: id,
      meta: { version: row.version },
    });
    return row;
  }

  previewTemplate(id: string, vars: Record<string, string>) {
    return this.templates.findOneByOrFail({ id }).then((tpl) => ({
      body: ensureOptOutFooter(
        fillTemplateStrict(tpl.body, vars, tpl.variables || undefined),
        tpl.messageClass as SmsMessageClass,
      ),
      parts: countSmsParts(
        ensureOptOutFooter(
          fillTemplateStrict(tpl.body, vars, tpl.variables || undefined),
          tpl.messageClass as SmsMessageClass,
        ),
      ),
    }));
  }

  // ----- campaigns -----
  async createCampaign(
    actorId: string,
    dto: {
      name: string;
      messageClass: SmsMessageClass;
      body: string;
      listId?: string;
      templateId?: string;
      scheduledAt?: string;
    },
    actorRole?: string,
  ) {
    if (dto.messageClass === 'OTP') {
      throw new BadRequestException({
        message: 'کمپین OTP مجاز نیست',
        code: 'SMS_INVALID_CLASS',
      });
    }
    if (
      dto.messageClass === 'TRANSACTIONAL' &&
      actorRole &&
      !(SMS_MANAGERS as readonly string[]).includes(actorRole)
    ) {
      throw new ForbiddenException({
        message: 'کمپین تراکنشی فقط برای مدیر پیامک مجاز است',
        code: 'SMS_FORBIDDEN',
      });
    }
    const body = ensureOptOutFooter(dto.body, dto.messageClass);
    const row = await this.campaigns.save(
      this.campaigns.create({
        name: dto.name,
        messageClass: dto.messageClass,
        bodySnapshot: body,
        listId: dto.listId || null,
        templateId: dto.templateId || null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: 'DRAFT',
        createdBy: actorId,
        recipientCount: 0,
        estimatedParts: 0,
        estimatedCost: 0,
      }),
    );
    await this.auditLog({
      actorId,
      action: 'campaign.create',
      targetType: 'campaign',
      targetId: row.id,
    });
    return row;
  }

  listCampaigns() {
    return this.campaigns.find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  getCampaign(id: string) {
    return this.campaigns.findOneByOrFail({ id });
  }

  async previewCampaign(id: string) {
    const campaign = await this.getCampaign(id);
    const members = campaign.listId
      ? await this.members.find({ where: { listId: campaign.listId }, take: 50_000 })
      : [];
    const reasons: Record<string, number> = {
      invalid: 0,
      blacklist: 0,
      unsubscribe: 0,
      suppression: 0,
      noConsent: 0,
      ok: 0,
    };
    const eligibleRows: Array<{ phone: string; customerId: string | null }> = [];
    const samples: string[] = [];
    const isPromo = campaign.messageClass === 'PROMO';
    for (const m of members) {
      const phone = normalizeIranMobileStrict(m.phoneNormalized);
      if (!phone) {
        reasons.invalid += 1;
        continue;
      }
      if (await this.isBlacklisted(phone, campaign.messageClass as SmsMessageClass)) {
        reasons.blacklist += 1;
        continue;
      }
      const un = await this.unsubscribes.findOne({ where: { phoneNormalized: phone } });
      if (un && !un.resubscribedAt) {
        reasons.unsubscribe += 1;
        continue;
      }
      const suppressed = await this.suppressions.findOne({ where: { phoneNormalized: phone } });
      if (suppressed) {
        reasons.suppression += 1;
        continue;
      }
      if (isPromo && !(await this.hasPromoConsent(m.customerId))) {
        reasons.noConsent += 1;
        continue;
      }
      reasons.ok += 1;
      eligibleRows.push({ phone, customerId: m.customerId });
      if (samples.length < 5) samples.push(campaign.bodySnapshot);
    }
    const partEach = countSmsParts(campaign.bodySnapshot);
    const estimatedParts = eligibleRows.length * partEach;
    campaign.recipientCount = eligibleRows.length;
    campaign.estimatedParts = estimatedParts;
    campaign.estimatedCost = estimatedParts;
    campaign.audienceSnapshotHash = hashToken(
      eligibleRows
        .map((r) => r.phone)
        .sort()
        .join(','),
    );
    await this.campaigns.save(campaign);
    const available = await this.availableCredit();
    return {
      campaign,
      eligible: eligibleRows.length,
      rejected: reasons,
      samples,
      estimatedParts,
      credit: available,
      insufficient: estimatedParts > available,
      eligibleRows,
    };
  }

  async prepareCampaign(actorId: string, id: string) {
    const preview = await this.previewCampaign(id);
    if (preview.insufficient) {
      throw new HttpException(
        {
          message: `اعتبار ناکافی است (نیاز به ${preview.estimatedParts} پیامک).`,
          code: 'SMS_INSUFFICIENT_CREDIT',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    const campaign = preview.campaign;
    const partEach = countSmsParts(campaign.bodySnapshot);
    await this.campaignRecipients.delete({ campaignId: campaign.id });
    for (const row of preview.eligibleRows || []) {
      await this.campaignRecipients.save(
        this.campaignRecipients.create({
          campaignId: campaign.id,
          phoneNormalized: row.phone,
          customerId: row.customerId,
          parts: partEach,
        }),
      );
    }

    const admin = await this.users.findOne({ where: { id: actorId } });
    const adminPhone = admin?.phone ? normalizeIranMobileStrict(admin.phone) : null;
    if (!adminPhone) {
      throw new BadRequestException({
        message: 'برای تأیید کمپین، شماره موبایل مدیر در پروفایل کاربر الزامی است',
        code: 'SMS_ADMIN_PHONE_REQUIRED',
      });
    }

    const otpPlain = String(randomInt(100_000, 1_000_000));
    const otpHash = hashToken(otpPlain);
    const otpExpiresAt = new Date(Date.now() + 5 * 60_000);
    const secrets = await this.providerSvc.resolvedSecrets();
    const provider = this.providerSvc.get();
    if (secrets.otpTemplateId) {
      await provider.sendTemplate({
        to: adminPhone,
        templateId: secrets.otpTemplateId,
        params: { code: otpPlain },
      });
    } else if (process.env.NODE_ENV === 'test') {
      await provider.sendSingle({
        to: adminPhone,
        body: `OTP:${otpPlain}`,
        idempotencyKey: `camp-otp:${campaign.id}:${Date.now()}`,
      });
    } else {
      throw new BadRequestException({
        message: 'قالب OTP برای تأیید کمپین پیکربندی نشده است',
        code: 'SMS_OTP_TEMPLATE_REQUIRED',
      });
    }

    const ph = this.campaignPayloadHash(campaign);
    const rawToken = randomBytes(24).toString('hex');
    await this.confirmations.save(
      this.confirmations.create({
        campaignId: campaign.id,
        tokenHash: hashToken(rawToken),
        payloadHash: ph,
        expiresAt: new Date(Date.now() + 10 * 60_000),
        usedAt: null,
        actorId,
        otpHash,
        otpExpiresAt,
        otpAttempts: 0,
      }),
    );
    campaign.status = 'PREPARED';
    await this.campaigns.save(campaign);
    await this.auditLog({
      actorId,
      action: 'campaign.prepare',
      targetType: 'campaign',
      targetId: id,
      meta: { otpSentTo: maskMobile(adminPhone) },
    });
    return {
      confirmationToken: rawToken,
      expiresInSec: 600,
      otpExpiresInSec: 300,
      recipientCount: campaign.recipientCount,
      estimatedParts: campaign.estimatedParts,
    };
  }

  async confirmCampaign(
    actorId: string,
    id: string,
    dto: { token: string; typedCount?: number | string; otp?: string },
  ) {
    const campaign = await this.getCampaign(id);
    if (!canConfirmCampaign(campaign.status)) {
      throw new ConflictException({
        message: 'کمپین باید در وضعیت آماده‌شده باشد',
        code: 'SMS_BAD_STATE',
      });
    }
    const tokenHash = hashToken(String(dto.token || ''));
    const confs = await this.confirmations.find({
      where: { campaignId: id, tokenHash },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const conf = confs[0];
    if (!conf || !confirmationTokenActive(conf)) {
      throw new ConflictException({
        message: 'توکن تأیید نامعتبر یا منقضی است. دوباره آماده کنید.',
        code: 'SMS_TOKEN_INVALID',
      });
    }
    if (this.campaignPayloadHash(campaign) !== conf.payloadHash) {
      throw new ConflictException({
        message: 'کمپین پس از آماده‌سازی تغییر کرده است. دوباره آماده کنید.',
        code: 'SMS_TOKEN_STALE',
      });
    }
    const typed = Number(
      String(dto.typedCount ?? '')
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/[^\d]/g, ''),
    );
    if (typed !== campaign.recipientCount) {
      throw new BadRequestException({
        message: 'تعداد گیرندگان واردشده با خلاصه هم‌خوانی ندارد.',
        code: 'SMS_COUNT_MISMATCH',
      });
    }
    const otpNorm = normalizeCampaignOtp(String(dto.otp || ''));
    if (!isValidCampaignOtpLength(otpNorm)) {
      throw new BadRequestException({
        message: 'کد تأیید ۶ رقمی ادمین الزامی است.',
        code: 'SMS_OTP_REQUIRED',
      });
    }
    if (!conf.otpHash || !conf.otpExpiresAt || conf.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        message: 'کد تأیید منقضی شده است. دوباره آماده کنید.',
        code: 'SMS_OTP_EXPIRED',
      });
    }
    if ((conf.otpAttempts || 0) >= 5) {
      throw new BadRequestException({
        message: 'تعداد تلاش OTP بیش از حد مجاز است',
        code: 'SMS_OTP_MAX_ATTEMPTS',
      });
    }
    if (!otpHashMatches(conf.otpHash, otpNorm)) {
      conf.otpAttempts = (conf.otpAttempts || 0) + 1;
      await this.confirmations.save(conf);
      throw new BadRequestException({
        message: 'کد تأیید ادمین نادرست است',
        code: 'SMS_OTP_INVALID',
      });
    }
    conf.usedAt = new Date();
    await this.confirmations.save(conf);
    campaign.confirmedBy = actorId;
    campaign.confirmedAt = new Date();
    const needsFourEyes =
      campaign.messageClass === 'PROMO' || campaign.recipientCount > 1000;
    campaign.status = needsFourEyes ? 'AWAITING_APPROVAL' : 'SCHEDULED';
    await this.campaigns.save(campaign);
    if (!needsFourEyes) {
      await this.enqueueCampaign(campaign);
    }
    await this.auditLog({
      actorId,
      action: 'campaign.confirm',
      targetType: 'campaign',
      targetId: id,
      meta: { status: campaign.status },
    });
    return campaign;
  }

  async approveCampaign(actorId: string, id: string, dto: { token?: string; reject?: boolean; reason?: string }) {
    const campaign = await this.getCampaign(id);
    if (campaign.status !== 'AWAITING_APPROVAL') {
      throw new ConflictException({ message: 'کمپین در انتظار تأیید نیست', code: 'SMS_BAD_STATE' });
    }
    const fourEyes = checkFourEyesApproval(actorId, campaign.createdBy);
    if (fourEyes) {
      throw new ForbiddenException({
        message: 'سازنده کمپین نمی‌تواند خودش را تأیید کند',
        code: fourEyes.code,
      });
    }
    if (dto.reject) {
      campaign.status = 'CANCELLED';
      campaign.rejectReason = dto.reason || 'رد شده';
      await this.campaigns.save(campaign);
      await this.auditLog({
        actorId,
        action: 'campaign.cancel',
        targetType: 'campaign',
        targetId: id,
        meta: { reason: campaign.rejectReason },
      });
      return campaign;
    }
    const confs = await this.confirmations.find({
      where: { campaignId: id },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const conf = confs[0];
    if (!conf || this.campaignPayloadHash(campaign) !== conf.payloadHash) {
      throw new ConflictException({
        message: 'کمپین پس از آماده‌سازی تغییر کرده است. دوباره آماده کنید.',
        code: 'SMS_TOKEN_STALE',
      });
    }
    const available = await this.availableCredit(true);
    if (campaign.estimatedParts > available) {
      throw new HttpException(
        {
          message: `اعتبار ناکافی است (نیاز به ${campaign.estimatedParts} پیامک).`,
          code: 'SMS_INSUFFICIENT_CREDIT',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    campaign.approvedBy = actorId;
    campaign.approvedAt = new Date();
    campaign.status = 'SCHEDULED';
    await this.campaigns.save(campaign);
    await this.enqueueCampaign(campaign);
    await this.auditLog({
      actorId,
      action: 'campaign.approve',
      targetType: 'campaign',
      targetId: id,
    });
    return campaign;
  }

  private async enqueueCampaign(campaign: SmsCampaignEntity) {
    const recipients = await this.campaignRecipients.find({
      where: { campaignId: campaign.id },
    });
    if (!recipients.length) return;
    const panel = await this.getPanelSettings();
    let when = campaign.scheduledAt || new Date();
    if (
      campaign.messageClass === 'PROMO' &&
      !isWithinPromoWindow(when, promoWindowFromSettings(panel))
    ) {
      when = nextPromoWindowOpen(when, promoWindowFromSettings(panel)) || when;
    }
    for (const m of recipients) {
      const phone = normalizeIranMobileStrict(m.phoneNormalized);
      if (!phone) continue;
      const key = `camp:${campaign.id}:${phone}`;
      const exists = await this.messages.findOne({ where: { idempotencyKey: key } });
      if (exists) continue;
      await this.messages.save(
        this.messages.create({
          campaignId: campaign.id,
          messageClass: campaign.messageClass,
          phoneNormalized: phone,
          customerId: m.customerId,
          body: campaign.bodySnapshot,
          parts: m.parts || countSmsParts(campaign.bodySnapshot),
          status: 'QUEUED',
          nextAttemptAt: when,
          idempotencyKey: key,
          provider: this.providerSvc.get().id,
        }),
      );
    }
    campaign.status = 'SENDING';
    await this.campaigns.save(campaign);
  }

  async canaryCampaign(actorId: string, id: string, actorRole: string) {
    const campaign = await this.getCampaign(id);
    const panel = await this.getPanelSettings();
    const nums = panel.testNumbers
      .map((n) => normalizeIranMobileStrict(n))
      .filter(Boolean)
      .slice(0, 5) as string[];
    if (!nums.length) {
      throw new BadRequestException({
        message: 'شماره تست در تنظیمات تعریف نشده است',
        code: 'SMS_NO_TEST_NUMBERS',
      });
    }
    const results = [];
    for (const phone of nums) {
      results.push(
        await this.sendSingle({
          actorId,
          actorRole,
          to: phone,
          body: campaign.bodySnapshot,
          messageClass: campaign.messageClass as SmsMessageClass,
          consentExempt: true,
        }),
      );
    }
    await this.auditLog({
      actorId,
      action: 'campaign.canary',
      targetType: 'campaign',
      targetId: id,
      meta: { count: nums.length, consentExempt: true },
    });
    return { results };
  }

  async pauseCampaign(actorId: string, id: string) {
    const campaign = await this.getCampaign(id);
    if (!canPauseCampaign(campaign.status)) {
      throw new ConflictException({ message: 'فقط کمپین در حال ارسال یا زمان‌بندی‌شده قابل توقف است', code: 'SMS_BAD_STATE' });
    }
    campaign.status = 'PAUSED';
    await this.campaigns.save(campaign);
    await this.messages
      .createQueryBuilder()
      .update(SmsMessageEntity)
      .set({ status: 'PAUSED' })
      .where('campaignId = :id AND status IN (:...st)', {
        id,
        st: ['QUEUED', 'SENDING'],
      })
      .execute();
    await this.auditLog({ actorId, action: 'campaign.pause', targetType: 'campaign', targetId: id });
    return campaign;
  }

  async resumeCampaign(actorId: string, id: string) {
    const campaign = await this.getCampaign(id);
    if (!canResumeCampaign(campaign.status)) {
      throw new ConflictException({ message: 'فقط کمپین متوقف‌شده قابل ادامه است', code: 'SMS_BAD_STATE' });
    }
    campaign.status = 'SENDING';
    await this.campaigns.save(campaign);
    await this.messages.update(
      { campaignId: id, status: 'PAUSED' },
      { status: 'QUEUED', nextAttemptAt: new Date() },
    );
    await this.auditLog({ actorId, action: 'campaign.resume', targetType: 'campaign', targetId: id });
    return campaign;
  }

  async cancelCampaign(actorId: string, id: string) {
    const campaign = await this.getCampaign(id);
    if (!canCancelCampaign(campaign.status)) {
      throw new ConflictException({ message: 'این کمپین قابل لغو نیست', code: 'SMS_BAD_STATE' });
    }
    campaign.status = 'CANCELLED';
    await this.campaigns.save(campaign);
    await this.messages.update(
      { campaignId: id, status: In(['QUEUED', 'SENDING', 'PAUSED']) },
      { status: 'CANCELLED' },
    );
    await this.auditLog({ actorId, action: 'campaign.cancel', targetType: 'campaign', targetId: id });
    return campaign;
  }

  // ----- lists / blacklist / unsub / messages / reports / audit / inbound -----
  listLists() {
    return this.lists.find({ order: { createdAt: 'DESC' } });
  }

  async createList(actorId: string, dto: { name: string; description?: string; type?: string }) {
    return this.lists.save(
      this.lists.create({
        name: dto.name,
        description: dto.description || null,
        type: dto.type === 'DYNAMIC' ? 'DYNAMIC' : 'STATIC',
        createdBy: actorId,
      }),
    );
  }

  async importListMembers(listId: string, phones: string[]) {
    let ok = 0;
    let invalid = 0;
    let dup = 0;
    for (const raw of phones.slice(0, 50_000)) {
      const phone = normalizeIranMobileStrict(raw);
      if (!phone) {
        invalid += 1;
        continue;
      }
      try {
        await this.members.save(
          this.members.create({ listId, phoneNormalized: phone, vars: {}, customerId: null }),
        );
        ok += 1;
      } catch {
        dup += 1;
      }
    }
    return { ok, invalid, dup };
  }

  async listMembers(listId: string, actorRole?: string) {
    const rows = await this.members.find({ where: { listId }, take: 5000 });
    const maskPhones =
      actorRole === 'SMS_OPERATOR' ||
      actorRole === 'SMS_MARKETER';
    if (!maskPhones) return rows;
    return rows.map((r) => ({
      ...r,
      phoneNormalized: maskMobile(r.phoneNormalized),
    }));
  }

  async getMessage(id: string) {
    const row = await this.messages.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException({ message: 'پیام پیدا نشد', code: 'SMS_MESSAGE_NOT_FOUND' });
    }
    return { ...row, phoneNormalized: maskMobile(row.phoneNormalized) };
  }

  async addBlacklist(actorId: string, phoneRaw: string, reason: string, scope = 'ALL') {
    const phone = normalizeIranMobileStrict(phoneRaw);
    if (!phone) throw new BadRequestException({ message: 'شماره نامعتبر', code: 'SMS_INVALID_PHONE' });
    const row = await this.blacklist.save(
      this.blacklist.create({
        phoneNormalized: phone,
        reason,
        scope,
        createdBy: actorId,
      }),
    );
    await this.auditLog({
      actorId,
      action: 'blacklist.add',
      targetType: 'blacklist',
      targetId: phone,
      meta: { phone, reason },
    });
    return row;
  }

  listBlacklist() {
    return this.blacklist.find({ order: { createdAt: 'DESC' }, take: 1000 });
  }

  async removeBlacklist(actorId: string, phoneRaw: string) {
    const phone = normalizeIranMobileStrict(phoneRaw);
    if (!phone) throw new BadRequestException({ message: 'شماره نامعتبر', code: 'SMS_INVALID_PHONE' });
    await this.blacklist.delete({ phoneNormalized: phone });
    await this.auditLog({
      actorId,
      action: 'blacklist.remove',
      targetType: 'blacklist',
      targetId: phone,
      meta: { phone },
    });
  }

  async addUnsubscribe(actorId: string, phoneRaw: string, source = 'ADMIN') {
    const phone = normalizeIranMobileStrict(phoneRaw);
    if (!phone) throw new BadRequestException({ message: 'شماره نامعتبر', code: 'SMS_INVALID_PHONE' });
    const row = await this.unsubscribes.save(
      this.unsubscribes.create({
        phoneNormalized: phone,
        scope: 'PROMO',
        source,
        at: new Date(),
        resubscribedAt: null,
      }),
    );
    await this.suppressions.save(
      this.suppressions.create({
        phoneNormalized: phone,
        reason: `sms_unsubscribe:${source}`,
        createdByUserId: actorId,
      }),
    ).catch(() => undefined);
    await this.auditLog({
      actorId,
      action: 'unsubscribe.manual',
      targetType: 'unsubscribe',
      targetId: phone,
      meta: { phone },
    });
    return row;
  }

  listUnsubscribes() {
    return this.unsubscribes.find({ take: 1000 });
  }

  async removeUnsubscribe(actorId: string, phoneRaw: string) {
    const phone = normalizeIranMobileStrict(phoneRaw);
    if (!phone) throw new BadRequestException({ message: 'شماره نامعتبر', code: 'SMS_INVALID_PHONE' });
    const row = await this.unsubscribes.findOne({ where: { phoneNormalized: phone } });
    if (row) {
      row.resubscribedAt = new Date();
      await this.unsubscribes.save(row);
    }
    await this.suppressions.delete({ phoneNormalized: phone });
    await this.auditLog({
      actorId,
      action: 'unsubscribe.remove',
      targetType: 'unsubscribe',
      targetId: phone,
      meta: { phone },
    });
  }

  async listMessages(q: {
    campaignId?: string;
    status?: string;
    phone?: string;
    take?: number;
  }) {
    const where: any = {};
    if (q.campaignId) where.campaignId = q.campaignId;
    if (q.status) where.status = q.status;
    if (q.phone) {
      const p = normalizeIranMobileStrict(q.phone);
      if (p) where.phoneNormalized = p;
    }
    const rows = await this.messages.find({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(q.take || 100, 500),
    });
    return rows.map((r) => ({
      ...r,
      phoneNormalized: maskMobile(r.phoneNormalized),
    }));
  }

  async reportsSummary() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    const rows = await this.messages.find({
      where: {},
      take: 5000,
      order: { createdAt: 'DESC' },
    });
    const todayStart = tehranDayStart();
    const sentToday = rows.filter((r) => r.createdAt >= todayStart && ['SENT', 'DELIVERED'].includes(r.status)).length;
    const week = rows.filter((r) => r.createdAt >= since);
    const delivered = week.filter((r) => r.status === 'DELIVERED' || r.status === 'SENT').length;
    const failed = week.filter((r) => r.status === 'FAILED' || r.status === 'UNDELIVERED').length;
    const queued = rows.filter((r) => r.status === 'QUEUED' || r.status === 'SENDING').length;
    const unsubNew = await this.unsubscribes.count();
    return {
      sentToday,
      deliveryRate7d: week.length ? delivered / week.length : 0,
      queued,
      failed,
      unsubscribes: unsubNew,
    };
  }

  listAudit(take = 200) {
    return this.audit.find({ order: { at: 'DESC' }, take });
  }

  async pollInbound() {
    const since = new Date(Date.now() - 10 * 60_000);
    const items = await this.providerSvc.get().fetchInbound(since);
    let n = 0;
    for (const item of items) {
      const exists = await this.inbound.findOne({ where: { providerId: item.providerId } });
      if (exists) continue;
      const intent = parseInboundIntent(item.body);
      const phone = normalizeIranMobileStrict(item.from) || item.from;
      await this.inbound.save(
        this.inbound.create({
          providerId: item.providerId,
          from: phone,
          body: item.body,
          receivedAt: item.receivedAt,
          handledAs: intent,
        }),
      );
      // لغو و بازگشت روی شماره ثبت می‌شود. پرچم رضایت پیش‌فرض همکار عوض نمی‌شود.
      if (intent === 'UNSUBSCRIBE_11') {
        await this.addUnsubscribe('system', phone, 'INBOUND_11').catch(() => undefined);
      } else if (intent === 'RESUBSCRIBE_12') {
        await this.removeUnsubscribe('system', phone).catch(() => undefined);
      }
      n += 1;
    }
    return n;
  }

  async pollDelivery() {
    const rows = await this.messages.find({
      where: { status: In(['SENT', 'PENDING_UNKNOWN']) },
      take: 100,
      order: { createdAt: 'DESC' },
    });
    let n = 0;
    for (const row of rows) {
      if (!row.providerMessageId) continue;
      if (row.createdAt.getTime() < Date.now() - 72 * 60 * 60_000) continue;
      const reports = await this.providerSvc.get().getDeliveryStatus([row.providerMessageId]);
      const st = reports[0]?.state;
      if (st === 'DELIVERED') {
        row.status = 'DELIVERED';
        row.deliveryState = 'DELIVERED';
        row.deliveredAt = new Date();
        await this.messages.save(row);
        n += 1;
      } else if (st === 'UNDELIVERED' || st === 'FAILED') {
        row.status = 'UNDELIVERED';
        row.deliveryState = st;
        await this.messages.save(row);
        n += 1;
      }
    }
    return n;
  }

  dashboardDefaults() {
    return DEFAULT_SMS_PANEL_SETTINGS;
  }

  /** Probe reuses notification probe — never exposes secrets. */
  async probe() {
    return this.notifications.probe();
  }
}

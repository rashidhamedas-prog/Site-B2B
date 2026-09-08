import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketingFunnelEntity } from './entities/marketing-funnel.entity';
import { MarketingFunnelStepEntity } from './entities/marketing-funnel-step.entity';
import { MarketingTemplateEntity } from './entities/marketing-template.entity';
import { FUNNEL_CODES } from './customer-marketing.constants';
import { H2H_TEMPLATE_SEEDS } from './templates/h2h-defaults';

const FUNNELS = [
  { channel: 'RETAIL' as const, code: FUNNEL_CODES.RETAIL, title: 'ورود و نگهداری تکی' },
  { channel: 'WHOLESALE' as const, code: FUNNEL_CODES.WHOLESALE, title: 'درخواست و فعال‌سازی عمده' },
];

const STEPS: Array<{
  funnelCode: string;
  sortOrder: number;
  code: string;
  title: string;
  delaySeconds: number;
  actionType: 'SMS' | 'CALL';
  messageClass: 'NURTURE' | 'PROMO';
  templateCode: string;
  conditions: Record<string, unknown>;
  isActive: boolean;
}> = [
  { funnelCode: FUNNEL_CODES.RETAIL, sortOrder: 10, code: 'REGISTERED', title: 'ثبت‌نام تکی', delaySeconds: 0, actionType: 'SMS', messageClass: 'NURTURE', templateCode: 'retail.welcome.after_otp', conditions: { orderCountMax: 0 }, isActive: true },
  { funnelCode: FUNNEL_CODES.RETAIL, sortOrder: 20, code: 'CARE_14D', title: 'مراقبت ۱۴ روز', delaySeconds: 14 * 86400, actionType: 'SMS', messageClass: 'NURTURE', templateCode: 'retail.care.14d', conditions: { orderCountMin: 1 }, isActive: true },
  { funnelCode: FUNNEL_CODES.RETAIL, sortOrder: 30, code: 'WINBACK_30D', title: 'پیگیری ۳۰ روز', delaySeconds: 30 * 86400, actionType: 'SMS', messageClass: 'PROMO', templateCode: 'retail.winback.30d', conditions: {}, isActive: false },
  { funnelCode: FUNNEL_CODES.WHOLESALE, sortOrder: 10, code: 'APPLIED', title: 'درخواست ثبت شد', delaySeconds: 0, actionType: 'SMS', messageClass: 'NURTURE', templateCode: 'wholesale.apply.received', conditions: { customerStatus: 'PENDING' }, isActive: true },
  { funnelCode: FUNNEL_CODES.WHOLESALE, sortOrder: 20, code: 'PENDING_WAIT', title: 'انتظار بررسی', delaySeconds: 3 * 86400, actionType: 'SMS', messageClass: 'NURTURE', templateCode: 'wholesale.apply.pending_wait', conditions: { customerStatus: 'PENDING' }, isActive: true },
  { funnelCode: FUNNEL_CODES.WHOLESALE, sortOrder: 30, code: 'APPROVED_CALL', title: 'معارفه تماس', delaySeconds: 86400, actionType: 'CALL', messageClass: 'NURTURE', templateCode: 'wholesale.apply.approved_intro', conditions: { customerStatus: 'ACTIVE' }, isActive: true },
  { funnelCode: FUNNEL_CODES.WHOLESALE, sortOrder: 40, code: 'CATALOG', title: 'یادآوری کاتالوگ', delaySeconds: 2 * 86400, actionType: 'SMS', messageClass: 'NURTURE', templateCode: 'wholesale.catalog.first_nudge', conditions: { customerStatus: 'ACTIVE', orderCountMax: 0 }, isActive: true },
  { funnelCode: FUNNEL_CODES.WHOLESALE, sortOrder: 50, code: 'NONE_7D', title: 'هفت روز بدون سفارش', delaySeconds: 7 * 86400, actionType: 'SMS', messageClass: 'NURTURE', templateCode: 'wholesale.order.none_7d', conditions: { customerStatus: 'ACTIVE', orderCountMax: 0 }, isActive: true },
  { funnelCode: FUNNEL_CODES.WHOLESALE, sortOrder: 60, code: 'DORMANT_45D', title: '۴۵ روز سکوت', delaySeconds: 45 * 86400, actionType: 'SMS', messageClass: 'PROMO', templateCode: 'wholesale.dormant.45d', conditions: {}, isActive: false },
];

@Injectable()
export class MarketingSeedService implements OnModuleInit {
  private readonly logger = new Logger(MarketingSeedService.name);

  constructor(
    @InjectRepository(MarketingFunnelEntity) private readonly funnels: Repository<MarketingFunnelEntity>,
    @InjectRepository(MarketingFunnelStepEntity) private readonly steps: Repository<MarketingFunnelStepEntity>,
    @InjectRepository(MarketingTemplateEntity) private readonly templates: Repository<MarketingTemplateEntity>,
  ) {}

  async onModuleInit() {
    if (process.env.OMNICHANNEL_WORKER === 'true') return;
    try {
      await this.ensureSeeds();
    } catch (err) {
      this.logger.warn(`marketing seed skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async ensureSeeds() {
    const funnelIds = new Map<string, string>();
    for (const row of FUNNELS) {
      let funnel = await this.funnels.findOne({ where: { channel: row.channel, code: row.code } });
      if (!funnel) {
        funnel = await this.funnels.save(this.funnels.create(row));
      }
      funnelIds.set(row.code, funnel.id);
    }

    for (const step of STEPS) {
      const funnelId = funnelIds.get(step.funnelCode);
      if (!funnelId) continue;
      const existing = await this.steps.findOne({ where: { funnelId, code: step.code } });
      if (existing) continue;
      await this.steps.save(this.steps.create({
        funnelId,
        sortOrder: step.sortOrder,
        code: step.code,
        title: step.title,
        delaySeconds: step.delaySeconds,
        actionType: step.actionType,
        messageClass: step.messageClass,
        templateCode: step.templateCode,
        conditions: step.conditions,
        isActive: step.isActive,
      }));
    }

    for (const tpl of H2H_TEMPLATE_SEEDS) {
      const existing = await this.templates.findOne({ where: { channel: tpl.channel, code: tpl.code, version: 1 } });
      if (existing) continue;
      await this.templates.save(this.templates.create({
        channel: tpl.channel,
        code: tpl.code,
        version: 1,
        title: tpl.title,
        medium: tpl.medium,
        messageClass: tpl.messageClass,
        body: tpl.body,
        callScript: tpl.callScript ?? null,
        isActive: true,
      }));
    }
  }
}

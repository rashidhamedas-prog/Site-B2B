import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from '../notification/notification.service';
import { SettingsService } from '../settings/settings.service';
import { MarketingSendEntity } from './entities/marketing-send.entity';
import { MarketingConsentEntity } from './entities/marketing-consent.entity';
import { MarketingSuppressionEntity } from './entities/marketing-suppression.entity';
import { SETTINGS_KEY, SMS_IR_BULK_MAX } from './customer-marketing.constants';
import { resolveMarketingSettings } from './marketing-settings';
import { recheckDelivery } from './send-gates';

@Injectable()
export class MarketingSmsSender {
  private readonly logger = new Logger(MarketingSmsSender.name);

  constructor(
    @InjectRepository(MarketingSendEntity)
    private readonly sends: Repository<MarketingSendEntity>,
    @InjectRepository(MarketingConsentEntity)
    private readonly consents: Repository<MarketingConsentEntity>,
    @InjectRepository(MarketingSuppressionEntity)
    private readonly suppressions: Repository<MarketingSuppressionEntity>,
    private readonly notifications: NotificationService,
    private readonly settings: SettingsService,
  ) {}

  async deliverById(sendId: string): Promise<void> {
    const row = await this.sends.findOne({ where: { id: sendId } });
    if (!row) return;
    if (row.status !== 'QUEUED' && row.status !== 'SENDING') return;

    const cfg = resolveMarketingSettings(await this.settings.get(SETTINGS_KEY));
    const suppressed = row.phoneNormalized
      ? !!(await this.suppressions.findOne({ where: { phoneNormalized: row.phoneNormalized } }))
      : false;
    const consent = row.customerId
      ? await this.consents.findOne({ where: { customerId: row.customerId, channel: row.channel } })
      : null;
    const check = recheckDelivery({
      enabled: cfg.enabled,
      globalMode: cfg.mode,
      rowMode: row.mode,
      messageClass: row.messageClass === 'PROMO' ? 'PROMO' : 'NURTURE',
      hasCustomerId: !!row.customerId,
      consent: consent?.status ?? null,
      suppressed,
      treatRegisterAutoAsPromoConsent: cfg.treatRegisterAutoAsPromoConsent,
    });
    if (!check.allow && 'status' in check) {
      row.status = check.status;
      row.skipReason = check.reason;
      await this.sends.save(row);
      return;
    }

    const receptor = row.recipientActual || row.phoneNormalized;
    if (!receptor) {
      row.status = 'SKIPPED';
      row.skipReason = 'NO_PHONE';
      await this.sends.save(row);
      return;
    }
    row.status = 'SENDING';
    await this.sends.save(row);
    const ok = await this.notifications.sendSms(receptor, row.bodySnapshot);
    row.status = ok ? 'SENT' : 'FAILED';
    row.skipReason = ok ? null : 'PROVIDER';
    await this.sends.save(row);
    if (!ok) throw new Error('sms.ir marketing send failed');
  }

  async deliverCampaignChunk(phones: string[], body: string): Promise<boolean> {
    if (phones.length === 0) return true;
    if (phones.length > SMS_IR_BULK_MAX) {
      this.logger.warn(`campaign chunk ${phones.length} exceeds ${SMS_IR_BULK_MAX}`);
    }
    return this.notifications.sendBulkChunked(phones.slice(0, SMS_IR_BULK_MAX), body);
  }
}

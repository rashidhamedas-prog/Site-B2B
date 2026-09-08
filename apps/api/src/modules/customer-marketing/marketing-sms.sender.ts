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
    const claimed = await this.sends
      .createQueryBuilder()
      .update()
      .set({ status: 'SENDING' })
      .where('id = :id', { id: sendId })
      .andWhere('status IN (:...st)', { st: ['QUEUED', 'SENDING'] })
      .execute();
    if (!claimed.affected) return;

    const row = await this.sends.findOne({ where: { id: sendId } });
    if (!row || row.status !== 'SENDING') return;

    const blocked = await this.evaluateLiveRow(row);
    if (blocked) return;

    const fresh = await this.sends.findOne({ where: { id: sendId } });
    if (!fresh || fresh.status !== 'SENDING') return;
    const blockedAgain = await this.evaluateLiveRow(fresh);
    if (blockedAgain) return;

    const stillSending = await this.sends.findOne({ where: { id: sendId } });
    if (!stillSending || stillSending.status !== 'SENDING') return;

    const receptor = stillSending.recipientActual || stillSending.phoneNormalized;
    if (!receptor) {
      stillSending.status = 'SKIPPED';
      stillSending.skipReason = 'NO_PHONE';
      await this.sends.save(stillSending);
      return;
    }

    const ok = await this.notifications.sendSms(receptor, stillSending.bodySnapshot);
    await this.sends
      .createQueryBuilder()
      .update()
      .set({ status: ok ? 'SENT' : 'FAILED', skipReason: ok ? null : 'PROVIDER' })
      .where('id = :id', { id: sendId })
      .andWhere('status = :st', { st: 'SENDING' })
      .execute();
    if (!ok) throw new Error('sms.ir marketing send failed');
  }

  private async evaluateLiveRow(row: MarketingSendEntity): Promise<boolean> {
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
      await this.sends
        .createQueryBuilder()
        .update()
        .set({ status: check.status, skipReason: check.reason })
        .where('id = :id', { id: row.id })
        .andWhere('status = :st', { st: 'SENDING' })
        .execute();
      return true;
    }
    return false;
  }

  async deliverCampaignChunk(phones: string[], body: string): Promise<boolean> {
    if (phones.length === 0) return true;
    if (phones.length > SMS_IR_BULK_MAX) {
      this.logger.warn(`campaign chunk ${phones.length} exceeds ${SMS_IR_BULK_MAX}`);
    }
    return this.notifications.sendBulkChunked(phones.slice(0, SMS_IR_BULK_MAX), body);
  }
}

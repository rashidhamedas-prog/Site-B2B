import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SmsPanelService } from './sms-panel.service';
import { SmsProviderService } from './provider/sms-provider.service';

@Injectable()
export class SmsPanelJobs {
  private readonly logger = new Logger(SmsPanelJobs.name);
  private busy = false;

  constructor(
    private readonly sms: SmsPanelService,
    private readonly provider: SmsProviderService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchQueue() {
    if (process.env.NODE_ENV === 'test') return;
    if (this.busy) return;
    this.busy = true;
    try {
      const n = await this.sms.processQueue(40);
      if (n > 0) this.logger.log(`sms queue dispatched=${n}`);
    } catch (err: any) {
      this.logger.warn(`sms queue error: ${err?.message || err}`);
    } finally {
      this.busy = false;
    }
  }

  @Cron('*/5 * * * *')
  async deliveryPoll() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.sms.pollDelivery();
    } catch (err: any) {
      this.logger.warn(`sms dlr poll: ${err?.message || err}`);
    }
  }

  @Cron('*/2 * * * *')
  async inboundPoll() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.sms.pollInbound();
    } catch (err: any) {
      this.logger.warn(`sms inbound poll: ${err?.message || err}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshProvider() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.provider.refresh();
    } catch {
      /* ignore */
    }
  }
}

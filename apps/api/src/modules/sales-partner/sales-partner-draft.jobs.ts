import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SalesPartnerDraftService } from './sales-partner-draft.service';

@Injectable()
export class SalesPartnerDraftJobs {
  private readonly logger = new Logger(SalesPartnerDraftJobs.name);
  private running = false;

  constructor(private readonly drafts: SalesPartnerDraftService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireOpenDrafts() {
    if (this.running) return;
    this.running = true;
    try {
      const closed = await this.drafts.expireDue(40);
      if (closed > 0) this.logger.log(`sales-partner drafts expired ${closed} row(s)`);
    } catch (err: unknown) {
      this.logger.warn(`sales-partner draft expiry failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }
}

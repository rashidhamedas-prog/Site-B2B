import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SalesPartnerLedgerService } from './sales-partner-ledger.service';

@Injectable()
export class SalesPartnerLedgerJobs {
  private readonly logger = new Logger(SalesPartnerLedgerJobs.name);
  private running = false;

  constructor(private readonly ledger: SalesPartnerLedgerService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sync() {
    if (this.running) return;
    this.running = true;
    try {
      const n = await this.ledger.syncConverted();
      if (n > 0) this.logger.log(`sales-partner ledger wrote ${n} row(s)`);
    } catch (err: unknown) {
      this.logger.warn(`sales-partner ledger sync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }
}

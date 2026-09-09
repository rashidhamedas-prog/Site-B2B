import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VendorLedgerService } from './vendor-ledger.service';

@Injectable()
export class VendorLedgerJobs {
  private readonly logger = new Logger(VendorLedgerJobs.name);
  private running = false;

  constructor(private readonly ledger: VendorLedgerService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async releaseHeld() {
    if (this.running) return;
    this.running = true;
    try {
      const n = await this.ledger.releaseHeld();
      if (n > 0) this.logger.log(`Released ${n} held ledger entr(y/ies)`);
    } catch (err: unknown) {
      this.logger.warn(`ledger release failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SalesPartnerLedgerService } from './sales-partner-ledger.service';
import { SalesPartnerReferralService } from './sales-partner-referral.service';

@Injectable()
export class SalesPartnerLedgerJobs {
  private readonly logger = new Logger(SalesPartnerLedgerJobs.name);
  private running = false;

  constructor(
    private readonly ledger: SalesPartnerLedgerService,
    private readonly referrals: SalesPartnerReferralService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sync() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.ledger.syncPending();
      if (result.wrote > 0 || result.failed > 0 || result.backlog > result.wrote) {
        this.logger.log(
          `sales-partner ledger wrote ${result.wrote}, failed ${result.failed}, backlog ${result.backlog}`,
        );
      }
      const purged = await this.referrals.purgeExpiredSessions();
      if (purged > 0) this.logger.log(`sales-partner referral sessions purged ${purged}`);
    } catch (err: unknown) {
      this.logger.warn(`sales-partner ledger sync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }
}

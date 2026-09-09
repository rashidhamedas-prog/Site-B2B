import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FulfillmentService } from './fulfillment.service';

@Injectable()
export class FulfillmentJobs {
  private readonly logger = new Logger(FulfillmentJobs.name);
  private running = false;

  constructor(private readonly fulfillments: FulfillmentService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireAcceptSla() {
    if (this.running) return;
    this.running = true;
    try {
      const n = await this.fulfillments.expireOverdueAccepts();
      if (n > 0) this.logger.log(`SLA expire reassigned ${n} fulfillment parcel(s)`);
    } catch (err: unknown) {
      this.logger.warn(`SLA expire job failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }
}

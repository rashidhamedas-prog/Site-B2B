import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomerMarketingService } from './customer-marketing.service';

@Injectable()
export class CustomerMarketingJobs {
  private readonly logger = new Logger(CustomerMarketingJobs.name);

  constructor(private readonly marketing: CustomerMarketingService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async evaluateDue() {
    if (process.env.OMNICHANNEL_WORKER === 'true') return;
    try {
      await this.marketing.evaluateDue(40);
    } catch (err) {
      this.logger.warn(`evaluateDue: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

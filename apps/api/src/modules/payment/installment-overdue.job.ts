import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstallmentService } from './installment.service';

@Injectable()
export class InstallmentOverdueJob {
  private readonly logger = new Logger(InstallmentOverdueJob.name);

  constructor(private readonly installments: InstallmentService) {}

  /** Daily overdue sweep for internal B2B installment schedules. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async markOverdueSchedules() {
    try {
      const n = await this.installments.markOverdue();
      if (n > 0) {
        this.logger.log(`Marked ${n} installment schedule(s) OVERDUE`);
      }
    } catch (err) {
      this.logger.warn(`Installment overdue job failed: ${err}`);
    }
  }
}

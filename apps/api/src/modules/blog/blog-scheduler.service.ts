import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BlogService } from './blog.service';

@Injectable()
export class BlogSchedulerService {
  private readonly logger = new Logger(BlogSchedulerService.name);

  constructor(private readonly blog: BlogService) {}

  /** Every minute — publish due SCHEDULED posts (Asia/Tehran wall-clock via UTC publishAt). */
  @Cron(CronExpression.EVERY_MINUTE)
  async publishScheduled() {
    try {
      const result = await this.blog.publishDueScheduled();
      if (result.published > 0) {
        this.logger.log(`Auto-published ${result.published} scheduled blog post(s)`);
      }
    } catch (err) {
      this.logger.warn(`Scheduled publish failed: ${err}`);
    }
  }
}

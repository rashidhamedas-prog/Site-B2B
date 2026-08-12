import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeedsHealthService } from './feeds-health.service';

@ApiTags('feeds')
@Controller({ path: 'feeds', version: '1' })
export class FeedsHealthController {
  constructor(private readonly health: FeedsHealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'وضعیت سلامت فیدهای مارکت‌پلیس (Torob/Bam)' })
  getHealth() {
    return this.health.health();
  }
}

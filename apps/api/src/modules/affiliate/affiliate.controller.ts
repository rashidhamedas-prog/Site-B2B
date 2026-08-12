import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AffiliatePostbackService } from './affiliate-postback.service';

@ApiTags('affiliate')
@Controller({ path: 'affiliate', version: '1' })
export class AffiliateController {
  constructor(private readonly postback: AffiliatePostbackService) {}

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'سلامت پست‌بک افیلیت',
    description:
      'Process-local lastSuccess/lastError. Paid/cancelled fires are claim-before-send idempotent.',
  })
  health() {
    return this.postback.health();
  }
}

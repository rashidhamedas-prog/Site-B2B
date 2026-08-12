import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TorobService } from './torob.service';

/**
 * Admin/ops health for Torob order sync — separate from JWT-guarded Torob panel path.
 * Does not invent Torob private APIs; only exposes lastSuccess/lastError counters.
 */
@ApiTags('torob')
@Controller({ path: 'torob', version: '1' })
export class TorobHealthController {
  constructor(private readonly torob: TorobService) {}

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'سلامت همگام‌سازی سفارش تورب',
    description: 'Process-local lastSuccess/lastError. listOrders GET is idempotent/read-only.',
  })
  health() {
    return this.torob.health();
  }
}

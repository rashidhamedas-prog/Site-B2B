import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TorobService } from './torob.service';
import { TorobProductApiService } from './torob-product-api.service';
import { torobProductMetrics } from './torob-metrics';

@ApiTags('torob')
@Controller({ path: 'torob', version: '1' })
export class TorobHealthController {
  constructor(
    private readonly torob: TorobService,
    private readonly products: TorobProductApiService,
  ) {}

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'سلامت همگام‌سازی ترب',
    description: 'شمارنده‌ها بدون افشای توکن یا کلید.',
  })
  async health() {
    const metrics = torobProductMetrics.snapshot();
    const incomplete = await this.products.incompleteReport();
    const reasons = incomplete.reduce<Record<string, number>>((acc, row) => {
      acc[row.reason] = (acc[row.reason] || 0) + 1;
      return acc;
    }, {});
    return {
      integration: 'torob' as const,
      orders: this.torob.health(),
      products: {
        ok: metrics.status500 === 0 || (metrics.lastSuccessAt != null && metrics.lastErrorAt != null && metrics.lastSuccessAt >= metrics.lastErrorAt),
        ...metrics,
        incompleteCount: incomplete.length,
        incompleteReasons: reasons,
      },
    };
  }

  @Get('incomplete-products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'محصولات تکی که به‌خاطر داده ناقص در ترب منتشر نمی‌شوند' })
  async incomplete() {
    return { data: await this.products.incompleteReport() };
  }
}

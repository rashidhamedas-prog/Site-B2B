import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BasalamService } from './basalam.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

export function isDryRun(value?: string): boolean {
  return value === '1' || String(value || '').toLowerCase() === 'true';
}

@ApiTags('basalam')
@Controller({ path: 'basalam', version: '1' })
export class BasalamController {
  constructor(private readonly svc: BasalamService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'وضعیت اتصال باسلام' })
  status() {
    return this.svc.status();
  }

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'سلامت همگام‌سازی باسلام (lastSuccess/lastError)',
    description:
      'Process-local counters. Sync PATCH is idempotent by Basalam product id — safe to retry after failure.',
  })
  health() {
    return this.svc.health();
  }

  @Post('push-catalog')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ارسال محصولات تکی به غرفه باسلام',
    description:
      'Creates unpublished stall products via official OpenAPI, or maps existing stall rows. Retail only. Idempotent. ?dryRun=1 returns the payloads without any Basalam call.',
  })
  @ApiQuery({ name: 'dryRun', required: false, enum: ['1', '0'] })
  pushCatalog(@Query('limit') limit?: string, @Query('dryRun') dryRun?: string) {
    return this.svc.pushCatalog(Math.min(20, Math.max(1, Number(limit) || 8)), {
      dryRun: isDryRun(dryRun),
    });
  }

  @Post('sync-inventory')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'همگام‌سازی موجودی/قیمت با غرفه باسلام (?dryRun=1 بدون ارسال)' })
  @ApiQuery({ name: 'dryRun', required: false, enum: ['1', '0'] })
  sync(@Query('limit') limit?: string, @Query('dryRun') dryRun?: string) {
    return this.svc.syncInventory(Math.min(200, Math.max(1, Number(limit) || 50)), {
      dryRun: isDryRun(dryRun),
    });
  }

  @Get('catalog-export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'خروجی کاتالوگ برای ثبت دستی در باسلام' })
  catalog(@Query('limit') limit?: string) {
    return this.svc.catalogExport(Math.min(500, Math.max(1, Number(limit) || 200)));
  }
}

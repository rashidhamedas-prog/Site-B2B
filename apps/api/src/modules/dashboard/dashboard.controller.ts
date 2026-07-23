import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService, ReportPeriod } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'آمار کلی داشبورد ادمین' })
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('reports')
  @ApiOperation({ summary: 'گزارش‌های واقعی فروش و مشتریان' })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter', 'year'] })
  getReports(@Query('period') period?: string) {
    const allowed: ReportPeriod[] = ['week', 'month', 'quarter', 'year'];
    const p = allowed.includes(period as ReportPeriod) ? (period as ReportPeriod) : 'month';
    return this.dashboardService.getReports(p);
  }
}

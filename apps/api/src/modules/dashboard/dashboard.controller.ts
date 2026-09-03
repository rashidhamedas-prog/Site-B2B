import { Controller, Get, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { isWholesalePurpose } from '../auth/staff-access';
import { DashboardService, ReportPeriod } from './dashboard.service';
import { UserEntity } from '../auth/entities/user.entity';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
  ) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'آمار کلی داشبورد ادمین (داده زنده)' })
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('mine')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'آمار زنده داشبورد مشتری' })
  async getMine(@Request() req: Express.Request & { user: { sub: string; purpose?: string } }) {
    if (!isWholesalePurpose(req.user.purpose)) {
      throw new ForbiddenException('داشبورد عمده فقط با ورود پنل مشتری در دسترس است');
    }
    const user = await this.userRepo.findOne({ where: { id: req.user.sub } });
    if (!user?.customerId) {
      return {
        generatedAt: new Date().toISOString(),
        live: true,
        ordersThisMonth: 0,
        totalSpent: 0,
        outstanding: 0,
        creditRemaining: 0,
        recentOrders: [],
        customer: null,
      };
    }
    const stats = await this.dashboardService.getCustomerStats(user.customerId);
    if (stats.customer) {
      return {
        ...stats,
        customer: { ...stats.customer, lastLoginAt: user.lastLoginAt },
      };
    }
    return stats;
  }

  @Get('reports')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'گزارش‌های واقعی فروش و مشتریان' })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter', 'year'] })
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  getReports(@Query('period') period?: string, @Query('channel') channel?: string) {
    const allowed: ReportPeriod[] = ['week', 'month', 'quarter', 'year'];
    const p = allowed.includes(period as ReportPeriod) ? (period as ReportPeriod) : 'month';
    return this.dashboardService.getReports(p, channel);
  }
}

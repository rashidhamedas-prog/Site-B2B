import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, ParseIntPipe, DefaultValuePipe, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrderService } from './order.service';
import { UserEntity } from '../auth/entities/user.entity';

type JwtUser = { sub: string; id: string; role: string; phone: string; customerId?: string };

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'orders', version: '1' })
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
  ) {}

  @Post()
  @ApiOperation({ summary: 'ثبت سفارش جدید' })
  async create(
    @Request() req: Express.Request & { user: JwtUser },
    @Body() body: any,
  ) {
    // For CUSTOMER role, auto-inject their customerId from JWT
    if (req.user.role === 'CUSTOMER' && !body.customerId) {
      const customerId = req.user.customerId
        ?? (await this.userRepo.findOne({ where: { id: req.user.sub } }))?.customerId;
      if (!customerId) {
        throw new ForbiddenException('حساب مشتری شما هنوز تأیید نشده است. لطفاً با پشتیبانی تماس بگیرید.');
      }
      body = { ...body, customerId };
    }
    return this.orderService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'لیست سفارش‌ها' })
  async findAll(
    @Request() req: Express.Request & { user: JwtUser },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    // CUSTOMER role: only see their own orders
    if (req.user.role === 'CUSTOMER') {
      const user = await this.userRepo.findOne({ where: { id: req.user.sub } });
      const cid = user?.customerId;
      return this.orderService.findAll(page, limit, cid ?? undefined, status);
    }
    // ADMIN: can filter by any customer or see all
    return this.orderService.findAll(page, limit, customerId, status);
  }

  @Get('installment-eligibility/:customerId')
  @ApiOperation({ summary: 'بررسی واجد شرایط بودن اقساط' })
  installmentEligibility(@Param('customerId') customerId: string) {
    return this.orderService.installmentEligibility(customerId);
  }

  @Post('quote-discounts')
  @ApiOperation({ summary: 'محاسبه تخفیف‌های قابل اعمال (کد/طبقاتی/جانبی)' })
  quoteDiscounts(
    @Body() body: { customerId: string; subtotal: number; discountCode?: string; categoryIds?: string[] },
  ) {
    return this.orderService.quoteDiscounts(
      body.customerId,
      Number(body.subtotal) || 0,
      body.discountCode,
      body.categoryIds ?? [],
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات سفارش' })
  async findOne(
    @Request() req: Express.Request & { user: JwtUser },
    @Param('id') id: string,
  ) {
    const order = await this.orderService.findOne(id);
    // CUSTOMER: only their own order
    if (req.user.role === 'CUSTOMER') {
      const user = await this.userRepo.findOne({ where: { id: req.user.sub } });
      if (order.customerId !== user?.customerId) throw new ForbiddenException('دسترسی غیرمجاز');
    }
    return order;
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'تغییر وضعیت سفارش (ادمین)' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.orderService.updateStatus(id, status);
  }

  @Patch(':id/tracking')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'ثبت کد رهگیری، هزینه باربری و رسید (ادمین)' })
  addTracking(
    @Param('id') id: string,
    @Body('trackingCode') trackingCode: string,
    @Body('shippingMethod') shippingMethod?: string,
    @Body('freightCost') freightCost?: number,
    @Body('freightReceiptUrl') freightReceiptUrl?: string,
  ) {
    return this.orderService.addTracking(id, trackingCode, shippingMethod, {
      freightCost,
      freightReceiptUrl,
    });
  }
}

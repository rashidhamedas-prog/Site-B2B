import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrderService } from './order.service';
import { UserEntity } from '../auth/entities/user.entity';
import { CreateOrderDto, QuoteDiscountsDto } from './dto/create-order.dto';

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

  private isStaff(role: string) {
    return role === 'ADMIN' || role === 'STAFF' || role === 'SUPER_ADMIN';
  }

  private async resolveOwnCustomerId(user: JwtUser): Promise<string | undefined> {
    if (user.customerId) return user.customerId;
    return (await this.userRepo.findOne({ where: { id: user.sub } }))?.customerId ?? undefined;
  }

  @Post()
  @ApiOperation({ summary: 'ثبت سفارش جدید' })
  async create(
    @Request() req: Express.Request & { user: JwtUser },
    @Body() body: CreateOrderDto,
  ) {
    let customerId: string | undefined;
    if (this.isStaff(req.user.role)) {
      customerId = body.customerId || (await this.resolveOwnCustomerId(req.user));
    } else {
      // CUSTOMER (and any non-staff): always bind to JWT customer — ignore body.customerId
      customerId = await this.resolveOwnCustomerId(req.user);
    }
    if (!customerId) {
      throw new ForbiddenException(
        'حساب مشتری شما هنوز تأیید نشده است. لطفاً دوباره وارد شوید یا با پشتیبانی تماس بگیرید.',
      );
    }
    return this.orderService.create({ ...body, customerId });
  }

  @Get()
  @ApiOperation({ summary: 'لیست سفارش‌ها' })
  async findAll(
    @Request() req: Express.Request & { user: JwtUser },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('channel') channel?: string,
  ) {
    if (!this.isStaff(req.user.role)) {
      const cid = await this.resolveOwnCustomerId(req.user);
      return this.orderService.findAll(page, limit, cid ?? undefined, status, type, {
        includeDeleted: false,
        channel,
      });
    }
    return this.orderService.findAll(page, limit, customerId, status, type, {
      includeDeleted: true,
      channel,
    });
  }

  @Get('installment-eligibility/:customerId')
  @ApiOperation({ summary: 'بررسی واجد شرایط بودن اقساط' })
  async installmentEligibility(
    @Request() req: Express.Request & { user: JwtUser },
    @Param('customerId') customerId: string,
  ) {
    if (!this.isStaff(req.user.role)) {
      const own = await this.resolveOwnCustomerId(req.user);
      if (!own || own !== customerId) {
        throw new ForbiddenException('دسترسی غیرمجاز');
      }
    }
    return this.orderService.installmentEligibility(customerId);
  }

  @Post('quote-discounts')
  @ApiOperation({ summary: 'محاسبه تخفیف‌های قابل اعمال (کد/طبقاتی/جانبی)' })
  async quoteDiscounts(
    @Request() req: Express.Request & { user: JwtUser },
    @Body() body: QuoteDiscountsDto,
  ) {
    let customerId = body.customerId;
    if (!this.isStaff(req.user.role)) {
      customerId = await this.resolveOwnCustomerId(req.user);
      if (!customerId) throw new ForbiddenException('دسترسی غیرمجاز');
    }
    if (!customerId) throw new ForbiddenException('customerId الزامی است');
    return this.orderService.quoteDiscounts(
      customerId,
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
    if (!this.isStaff(req.user.role)) {
      const cid = await this.resolveOwnCustomerId(req.user);
      if (order.customerId !== cid) throw new ForbiddenException('دسترسی غیرمجاز');
      if (order.status === 'DELETED' || order.voidedAt) {
        throw new ForbiddenException('این سفارش حذف شده است');
      }
    }
    return order;
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'ویرایش سفارش (ادمین)' })
  update(
    @Param('id') id: string,
    @Body()
    body: {
      notes?: string;
      shippingAddress?: string | Record<string, unknown>;
      shippingMethod?: string;
      paymentMethod?: string;
      items?: Array<{ id: string; quantity: number }>;
    },
  ) {
    return this.orderService.updateOrder(id, body ?? {});
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'حذف نرم سفارش — ردیف می‌ماند، اثرات معکوس می‌شود' })
  voidOrder(
    @Param('id') id: string,
    @Body() body: { reason?: string } = {},
    @Request() req?: Express.Request & { user: JwtUser },
  ) {
    return this.orderService.voidOrder(id, body?.reason, req?.user?.sub);
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

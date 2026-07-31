import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  StartPaymentDto,
  VerifyPaymentDto,
  ManualPaymentDto,
} from '../order/dto/create-order.dto';

type JwtUser = { sub: string; id: string; role: string; phone: string; customerId?: string };

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly svc: PaymentService) {}

  private isStaff(role: string) {
    return role === 'ADMIN' || role === 'STAFF' || role === 'SUPER_ADMIN';
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  findAll() {
    return this.svc.findAll();
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  summary() {
    return this.svc.summary();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post('start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  start(
    @Request() req: Express.Request & { user: JwtUser },
    @Body() body: StartPaymentDto,
  ) {
    const customerId = this.isStaff(req.user.role)
      ? body.customerId || req.user.customerId
      : req.user.customerId;
    if (!customerId && !this.isStaff(req.user.role)) {
      throw new ForbiddenException('حساب مشتری یافت نشد');
    }
    return this.svc.start({
      orderId: body.orderId,
      invoiceId: body.invoiceId,
      customerId,
      description: body.description,
      mobile: body.mobile || req.user.phone,
      email: body.email,
      channel: body.channel,
      // amount from body is ignored — resolved server-side from order/invoice
    });
  }

  @Post('verify')
  verify(@Body() body: VerifyPaymentDto) {
    return this.svc.verify(body.paymentId, body.authority ?? '', body.status ?? 'OK');
  }

  @Post('manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  manual(@Body() body: ManualPaymentDto) {
    return this.svc.recordManual({
      amount: Number(body.amount),
      customerId: body.customerId,
      orderId: body.orderId,
      invoiceId: body.invoiceId,
      refId: body.refId,
      description: body.description,
    });
  }
}

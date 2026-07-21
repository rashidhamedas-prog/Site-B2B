import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

type JwtUser = { sub: string; id: string; role: string; phone: string; customerId?: string };

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly svc: PaymentService) {}

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

  // Start an online payment — authenticated portal customers.
  @Post('start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  start(
    @Request() req: Express.Request & { user: JwtUser },
    @Body() body: any,
  ) {
    return this.svc.start({
      amount: Number(body.amount),
      orderId: body.orderId,
      invoiceId: body.invoiceId,
      customerId: body.customerId || req.user.customerId,
      description: body.description,
      mobile: body.mobile || req.user.phone,
      email: body.email,
    });
  }

  // Gateway callback verification — public (user returns from ZarinPal redirect).
  @Post('verify')
  verify(@Body() body: { paymentId: string; authority?: string; status?: string }) {
    return this.svc.verify(body.paymentId, body.authority ?? '', body.status ?? 'OK');
  }

  // Manual payment entry — admin only.
  @Post('manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  manual(@Body() body: any) {
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

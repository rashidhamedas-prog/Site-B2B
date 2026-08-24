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
import { PaymentProviderRegistryService } from './payment-provider-registry.service';
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
  constructor(
    private readonly svc: PaymentService,
    private readonly providers: PaymentProviderRegistryService,
  ) {}

  private isStaff(role: string) {
    return role === 'ADMIN' || role === 'STAFF' || role === 'SUPER_ADMIN';
  }

  @Get('providers/eligible')
  eligible(@Request() req: Express.Request & { user?: JwtUser }) {
    // Public-ish: channel from query via body not available on GET — default BOTH filtered client-side safe
    const channel =
      (req as any).headers?.['x-taranom-channel'] === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
    return this.providers.listEligible(channel);
  }

  @Get('providers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  listProviders() {
    return this.providers.listAll().then((rows) =>
      rows.map((p) => ({
        ...p,
        // never expose secrets — configReference is a name only
        hasConfigReference: !!p.configReference,
      })),
    );
  }

  @Post('providers/:code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  updateProvider(@Param('code') code: string, @Body() body: Record<string, unknown>) {
    return this.providers.adminUpdate(code, body as any);
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

  /** Phase 8 — in-process counters; ADMIN only. Declared before :id. */
  @Get('metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  metrics() {
    return this.svc.metricsSnapshot();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  findOne(@Param('id') id: string) {
    return this.svc.findOnePublic(id);
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
      providerCode: body.providerCode,
    });
  }

  @Post('verify')
  verify(@Body() body: VerifyPaymentDto) {
    return this.svc.verify(body.paymentId, body.authority ?? '', body.status ?? '', {
      trackingCode: body.trackingCode,
      providerId: body.providerId,
      result: body.result,
      type: body.type,
    });
  }

  @Post('manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  manual(
    @Request() req: Express.Request & { user: JwtUser },
    @Body() body: ManualPaymentDto,
  ) {
    return this.svc.recordManual({
      amount: Number(body.amount),
      customerId: body.customerId,
      orderId: body.orderId,
      invoiceId: body.invoiceId,
      refId: body.refId,
      description: body.description,
      actorId: req.user.id || req.user.sub,
      reason: body.description,
    });
  }

  @Post('refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  refund(
    @Request() req: Express.Request & { user: JwtUser },
    @Body()
    body: {
      paymentId: string;
      amount: number;
      reason?: string;
      idempotencyKey: string;
      channel?: 'WALLET' | 'PROVIDER' | 'MANUAL';
    },
  ) {
    return this.svc.requestRefund({
      paymentId: body.paymentId,
      amount: Number(body.amount),
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
      requestedBy: req.user.id || req.user.sub,
      channel: body.channel,
    });
  }
}

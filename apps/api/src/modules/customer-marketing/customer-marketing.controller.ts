import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CustomerMarketingService } from './customer-marketing.service';

@ApiTags('customers-marketing')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller({ path: 'customers/:customerId/marketing', version: '1' })
export class CustomerMarketingController {
  constructor(private readonly marketing: CustomerMarketingService) {}

  @Get()
  @ApiOperation({ summary: 'پرونده بازاریابی مشتری' })
  dossier(@Param('customerId') customerId: string) {
    return this.marketing.dossier(customerId);
  }

  @Post('calls')
  logCall(
    @Param('customerId') customerId: string,
    @Body() body: { result: string; notes?: string },
    @Req() req: { user?: { sub?: string; role?: string } },
  ) {
    return this.marketing.logCall(customerId, body, { id: req.user?.sub, role: req.user?.role });
  }

  @Post('sms')
  sendSms(
    @Param('customerId') customerId: string,
    @Body() body: { templateCode?: string; body?: string; idempotencyKey?: string },
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: { user?: { sub?: string; role?: string } },
  ) {
    return this.marketing.previewOrSendSms(
      customerId,
      { ...body, idempotencyKey: body.idempotencyKey || idempotencyKey },
      { id: req.user?.sub, role: req.user?.role },
    );
  }

  @Post('opt-out')
  optOut(
    @Param('customerId') customerId: string,
    @Req() req: { user?: { sub?: string; role?: string } },
  ) {
    return this.marketing.optOut(customerId, { id: req.user?.sub, role: req.user?.role });
  }

  @Post('opt-in')
  @AdminOnly()
  optIn(
    @Param('customerId') customerId: string,
    @Req() req: { user?: { sub?: string; role?: string } },
  ) {
    return this.marketing.optIn(customerId, { id: req.user?.sub, role: req.user?.role });
  }

  @Post('stage')
  setStage(
    @Param('customerId') customerId: string,
    @Body() body: { stage: string; reason?: string },
    @Req() req: { user?: { sub?: string; role?: string } },
  ) {
    return this.marketing.setStage(customerId, body.stage, body.reason || '', { id: req.user?.sub, role: req.user?.role });
  }

  @Post('enroll')
  enroll(
    @Param('customerId') customerId: string,
    @Req() req: { user?: { sub?: string; role?: string } },
  ) {
    return this.marketing.enroll(customerId, { actorId: req.user?.sub });
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SalesPartnerDraftService } from './sales-partner-draft.service';
import { ConfirmSalesPartnerDraftDto } from './dto/sales-partner-draft.dto';

@ApiTags('sales-partner-confirmations')
@Controller({ path: 'sales-partner-confirmations', version: '1' })
export class SalesPartnerConfirmationController {
  constructor(private readonly drafts: SalesPartnerDraftService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.drafts.publicByToken(token);
  }

  @Post(':token/confirm')
  confirm(@Param('token') token: string, @Body() body: ConfirmSalesPartnerDraftDto) {
    return this.drafts.confirmByToken(token, body);
  }

  @Post(':token/reject')
  reject(@Param('token') token: string) {
    return this.drafts.rejectByToken(token);
  }
}

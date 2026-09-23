import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SalesPartnerService } from './sales-partner.service';
import { ApplySalesPartnerDto, VerifySalesPartnerApplicationDto } from './dto/apply-sales-partner.dto';

@ApiTags('sales-partners')
@Controller({ path: '', version: '1' })
export class SalesPartnerPublicController {
  constructor(private readonly salesPartners: SalesPartnerService) {}

  @Get('sales-partner-program/public-settings')
  publicSettings() {
    return this.salesPartners.publicSettings();
  }

  @Post('sales-partner-applications')
  apply(@Body() body: ApplySalesPartnerDto) {
    return this.salesPartners.apply(body);
  }

  @Post('sales-partner-applications/verify')
  verify(@Body() body: VerifySalesPartnerApplicationDto) {
    return this.salesPartners.verifyApplication(body);
  }
}

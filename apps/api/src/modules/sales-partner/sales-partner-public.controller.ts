import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SalesPartnerService } from './sales-partner.service';
import { SalesPartnerCatalogService } from './sales-partner-catalog.service';
import { SalesPartnerReferralService } from './sales-partner-referral.service';
import { ApplySalesPartnerDto, VerifySalesPartnerApplicationDto } from './dto/apply-sales-partner.dto';

@ApiTags('sales-partners')
@Controller({ path: '', version: '1' })
export class SalesPartnerPublicController {
  constructor(
    private readonly salesPartners: SalesPartnerService,
    private readonly catalog: SalesPartnerCatalogService,
    private readonly referrals: SalesPartnerReferralService,
  ) {}

  @Get('sales-partner-links/:code/:slug')
  resolveShareLink(@Param('code') code: string, @Param('slug') slug: string) {
    return this.catalog.resolveShareLink(code, slug);
  }

  @Post('sales-partner-links/:code/:slug/click')
  click(
    @Param('code') code: string,
    @Param('slug') slug: string,
    @Body() body: { previousToken?: string },
  ) {
    return this.referrals.issueClick(code, slug, body?.previousToken);
  }

  @Post('sales-partner-referral/status')
  referralStatus(@Body() body: { token?: string }) {
    return this.referrals.statusForToken(body?.token);
  }

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

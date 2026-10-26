import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SalesPartnerService } from './sales-partner.service';
import { SalesPartnerCatalogService } from './sales-partner-catalog.service';
import { ApplySalesPartnerDto, VerifySalesPartnerApplicationDto } from './dto/apply-sales-partner.dto';

@ApiTags('sales-partners')
@Controller({ path: '', version: '1' })
export class SalesPartnerPublicController {
  constructor(
    private readonly salesPartners: SalesPartnerService,
    private readonly catalog: SalesPartnerCatalogService,
  ) {}

  @Get('sales-partner-links/:code/:slug')
  resolveShareLink(
    @Param('code') code: string,
    @Param('slug') slug: string,
    @Query('prior') prior: string | undefined,
    @Req() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const forwarded = req.headers?.['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0];
    const uaRaw = req.headers?.['user-agent'];
    const userAgent = Array.isArray(uaRaw) ? uaRaw[0] : String(uaRaw || '');
    const priorProductIds = String(prior || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 12);
    return this.catalog.resolveShareLink(code, slug, {
      ip: String(forwardedIp || req.ip || 'unknown').trim(),
      userAgent,
      priorProductIds,
    });
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

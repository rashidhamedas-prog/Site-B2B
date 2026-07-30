import { Controller, Get, Put, Body, Param, Query, UseGuards, BadRequestException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const GROUPS = [
  'business',
  'shipping',
  'sms',
  'payment',
  'installments',
  'theme',
  'menus',
  'menus_wholesale',
  'menus_retail',
  'marketing',
  'siteContent',
] as const;

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  // Public, safe subset — used by the storefront (contact info, active
  // shipping methods). Never exposes API keys.
  @Get('public')
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  async publicSettings(
    @Query('channel') channel?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    res?.setHeader(
      'Cache-Control',
      'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
    );
    const [business, shipping, installments, payment, theme, menus, marketing] = await Promise.all([
      this.svc.business(),
      this.svc.shipping(),
      this.svc.installments(),
      this.svc.payment(),
      this.svc.theme(),
      this.svc.menus(channel),
      this.svc.marketing(),
    ]);
    return {
      business: {
        businessName: business.businessName,
        phone: business.phone,
        email: business.email,
        instagram: business.instagram,
        telegram: business.telegram,
        address: business.address,
        officeAddress: business.officeAddress,
        minOrderToman: business.minOrderToman,
        limitedStockMultiplier: business.limitedStockMultiplier,
        newBadgeDays: business.newBadgeDays,
      },
      shipping: (() => {
        const ch = String(channel || '').toUpperCase();
        const retail = shipping.retail;
        const wholesale = shipping.wholesale;
        // Channel-aware flat fields for storefront checkout; nested for admin/tools
        const flat =
          ch === 'WHOLESALE'
            ? {
                freeThreshold: wholesale.freeThreshold,
                baseFee: wholesale.baseFee,
                perKgFee: 0,
                kgPerPiece: retail.kgPerPiece,
              }
            : {
                freeThreshold: retail.freeThreshold,
                baseFee: retail.baseFee,
                perKgFee: retail.perKgFee,
                kgPerPiece: retail.kgPerPiece,
              };
        return {
          companies: shipping.companies,
          ...flat,
          retail: {
            freeThreshold: retail.freeThreshold,
            baseFee: retail.baseFee,
            perKgFee: retail.perKgFee,
            kgPerPiece: retail.kgPerPiece,
          },
          wholesale: {
            freeThreshold: wholesale.freeThreshold,
            baseFee: wholesale.baseFee,
          },
        };
      })(),
      installments,
      // Safe flags only — never expose merchantId / secrets
      payment: {
        enabled: !!payment.enabled,
        manualCardNumber: payment.manualCardNumber || '',
        manualCardOwner: payment.manualCardOwner || '',
      },
      theme,
      menus,
      channel: channel ? String(channel).toUpperCase() : undefined,
      marketing: {
        feedBrandName: marketing.feedBrandName || 'پوشاک ترنم',
        ga4WholesaleId: marketing.ga4WholesaleId || '',
        ga4RetailId: marketing.ga4RetailId || '',
        gtmWholesaleId: marketing.gtmWholesaleId || '',
        gtmRetailId: marketing.gtmRetailId || '',
        gscWholesaleVerification: marketing.gscWholesaleVerification || '',
        gscRetailVerification: marketing.gscRetailVerification || '',
        yektanetPixelId: marketing.yektanetPixelId || '',
        metaPixelId: marketing.metaPixelId || '',
        adroScriptUrl: marketing.adroScriptUrl || '',
        adroAccountId: marketing.adroAccountId || '',
        afferScriptUrl: marketing.afferScriptUrl || '',
        afsonaScriptUrl: marketing.afsonaScriptUrl || '',
        takhfifanScriptUrl: marketing.takhfifanScriptUrl || '',
        // Never expose postback URLs, tokens, or product maps publicly
        basalamEnabled: !!marketing.basalamEnabled,
      },
    };
  }

  // Admin: full resolved settings for the settings page.
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  async adminSettings(@Query('channel') channel?: string) {
    const [business, shipping, sms, payment, installments, theme, menus, marketing, siteContent] =
      await Promise.all([
        this.svc.business(),
        this.svc.shipping(),
        this.svc.sms(),
        this.svc.payment(),
        this.svc.installments(),
        this.svc.theme(),
        this.svc.menus(channel),
        this.svc.marketing(),
        this.svc.siteContent(),
      ]);
    return { business, shipping, sms, payment, installments, theme, menus, marketing, siteContent };
  }

  // Admin: save one settings group.
  @Put('admin/:group')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  async save(@Param('group') group: string, @Body() body: Record<string, any>) {
    if (!GROUPS.includes(group as any)) {
      throw new BadRequestException('گروه تنظیمات نامعتبر است');
    }
    let value = body ?? {};
    if (group === 'marketing') {
      const prev = await this.svc.get('marketing');
      value = {
        ...prev,
        ...value,
        // Preserve product map unless explicitly sent
        basalamProductMap:
          value.basalamProductMap && typeof value.basalamProductMap === 'object'
            ? value.basalamProductMap
            : prev.basalamProductMap ?? {},
      };
    }
    // Nested menus save: body may be { wholesale, retail } or flat (= wholesale)
    if (group === 'menus' && body?.wholesale && body?.retail) {
      value = body;
    }
    await this.svc.set(group, value);
    return { saved: true, group };
  }
}

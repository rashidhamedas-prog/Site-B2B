import { Controller, Get, Put, Body, Param, Query, UseGuards, BadRequestException, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { resolveSmsOps } from '../notification/sms-ops';

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
  'smsOps',
  'shippingPost',
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
    @Res({ passthrough: true }) res?: FastifyReply,
  ) {
    res?.header(
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
        enamadWholesale: business.enamadWholesale,
        enamadRetail: business.enamadRetail,
      },
      shipping: (() => {
        const ch = String(channel || 'WHOLESALE').toUpperCase();
        const retail = shipping.retail;
        const wholesale = shipping.wholesale;
        // Channel-aware flat fields for storefront checkout; nested for admin/tools
        const flat =
          ch === 'RETAIL'
            ? {
                freeThreshold: retail.freeThreshold,
                baseFee: retail.baseFee,
                perKgFee: retail.perKgFee,
                kgPerPiece: retail.kgPerPiece,
              }
            : {
                freeThreshold: wholesale.freeThreshold,
                baseFee: wholesale.baseFee,
                perKgFee: 0,
                kgPerPiece: retail.kgPerPiece,
              };
        const channelCompanies = (ch === 'RETAIL' ? retail.companies : wholesale.companies) ?? [];
        return {
          companies: channelCompanies
            .filter((c: { isActive?: boolean }) => c?.isActive !== false)
            .map((c: { id: string; label: string }) => ({ id: c.id, label: c.label })),
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
        torobOrderSyncEnabled: !!marketing.torobOrderSyncEnabled,
      },
    };
  }

  // Admin: full resolved settings for the settings page.
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @AdminOnly()
  @ApiBearerAuth()
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  async adminSettings(@Query('channel') channel?: string) {
    const [business, shipping, sms, payment, installments, theme, menus, marketing, siteContent, smsOps, shippingPost] =
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
        this.svc.get('smsOps'),
        this.svc.shippingPost(),
      ]);
    return {
      business,
      shipping,
      sms,
      payment,
      installments,
      theme,
      menus,
      marketing,
      siteContent,
      smsOps: resolveSmsOps(smsOps),
      shippingPost,
    };
  }

  // Admin: save one settings group.
  @Put('admin/:group')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @AdminOnly()
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
    if (group === 'business') {
      const prev = await this.svc.get('business');
      const bodyBiz = body ?? {};
      value = {
        ...prev,
        ...bodyBiz,
        enamadWholesale: {
          ...(prev.enamadWholesale && typeof prev.enamadWholesale === 'object'
            ? prev.enamadWholesale
            : {}),
          ...(bodyBiz.enamadWholesale && typeof bodyBiz.enamadWholesale === 'object'
            ? bodyBiz.enamadWholesale
            : {}),
        },
        enamadRetail: {
          ...(prev.enamadRetail && typeof prev.enamadRetail === 'object' ? prev.enamadRetail : {}),
          ...(bodyBiz.enamadRetail && typeof bodyBiz.enamadRetail === 'object'
            ? bodyBiz.enamadRetail
            : {}),
        },
      };
    }
    if (group === 'shipping') {
      const prev = await this.svc.get('shipping');
      const bodyShip = body ?? {};
      value = {
        ...prev,
        ...bodyShip,
        retail: {
          ...(prev.retail && typeof prev.retail === 'object' ? prev.retail : {}),
          ...(bodyShip.retail && typeof bodyShip.retail === 'object' ? bodyShip.retail : {}),
        },
        wholesale: {
          ...(prev.wholesale && typeof prev.wholesale === 'object' ? prev.wholesale : {}),
          ...(bodyShip.wholesale && typeof bodyShip.wholesale === 'object' ? bodyShip.wholesale : {}),
        },
      };
    }
    if (group === 'shippingPost') {
      const prev = await this.svc.shippingPost();
      const bodyPost = body ?? {};
      const legacyFlat = !bodyPost.retail && !bodyPost.wholesale && bodyPost.enabled !== undefined;
      value = {
        retail: {
          ...prev.retail,
          ...(legacyFlat ? bodyPost : {}),
          ...(bodyPost.retail && typeof bodyPost.retail === 'object' ? bodyPost.retail : {}),
        },
        wholesale: {
          ...prev.wholesale,
          ...(bodyPost.wholesale && typeof bodyPost.wholesale === 'object' ? bodyPost.wholesale : {}),
        },
      };
    }
    if (group === 'smsOps') {
      const prev = resolveSmsOps(await this.svc.get('smsOps'));
      const bodyOps = body ?? {};
      value = {
        retail: { ...prev.retail, ...(bodyOps.retail && typeof bodyOps.retail === 'object' ? bodyOps.retail : {}) },
        wholesale: { ...prev.wholesale, ...(bodyOps.wholesale && typeof bodyOps.wholesale === 'object' ? bodyOps.wholesale : {}) },
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

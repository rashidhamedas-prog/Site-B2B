import { Controller, Get, Put, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const GROUPS = ['business', 'shipping', 'sms', 'payment', 'installments', 'theme', 'menus'] as const;

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  // Public, safe subset — used by the storefront (contact info, active
  // shipping methods). Never exposes API keys.
  @Get('public')
  async publicSettings() {
    const [business, shipping, installments, payment, theme, menus] = await Promise.all([
      this.svc.business(),
      this.svc.shipping(),
      this.svc.installments(),
      this.svc.payment(),
      this.svc.theme(),
      this.svc.menus(),
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
      },
      shipping: {
        companies: shipping.companies,
        freeThreshold: shipping.freeThreshold,
      },
      installments,
      // Safe flags only — never expose merchantId / secrets
      payment: {
        enabled: !!payment.enabled,
        manualCardNumber: payment.manualCardNumber || '',
        manualCardOwner: payment.manualCardOwner || '',
      },
      theme,
      menus,
    };
  }

  // Admin: full resolved settings for the settings page.
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  async adminSettings() {
    const [business, shipping, sms, payment, installments, theme, menus] = await Promise.all([
      this.svc.business(),
      this.svc.shipping(),
      this.svc.sms(),
      this.svc.payment(),
      this.svc.installments(),
      this.svc.theme(),
      this.svc.menus(),
    ]);
    return { business, shipping, sms, payment, installments, theme, menus };
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
    await this.svc.set(group, body ?? {});
    return { saved: true, group };
  }
}

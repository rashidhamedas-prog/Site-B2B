import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerMarketingService } from './customer-marketing.service';

@ApiTags('storefront-marketing')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'storefront/marketing', version: '1' })
export class StorefrontMarketingController {
  constructor(private readonly marketing: CustomerMarketingService) {}

  @Post('checkout-intent')
  @ApiOperation({ summary: 'ثبت ورود به چک‌اوت برای پیگیری سبد مانده (فقط کاربر لاگین)' })
  checkoutIntent(
    @Req() req: { user?: { customerId?: string; purpose?: string } },
    @Body() body: { channel?: string },
  ) {
    const customerId = req.user?.customerId;
    if (!customerId) return { ok: false, reason: 'NO_CUSTOMER' };
    const channel = body?.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    return this.marketing.recordCheckoutIntent(customerId, channel);
  }
}

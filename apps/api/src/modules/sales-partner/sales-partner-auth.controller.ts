import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SALES_PARTNER_ACTING_ROLE, isSalesPartnerPurpose } from './sales-partner-policy';
import { SalesPartnerService } from './sales-partner.service';
import {
  SalesPartnerOtpDto,
  SalesPartnerOtpVerifyDto,
  SalesPartnerPasswordLoginDto,
} from './dto/apply-sales-partner.dto';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('sales-partners')
@Controller({ path: 'sales-partners', version: '1' })
export class SalesPartnerAuthController {
  constructor(private readonly salesPartners: SalesPartnerService) {}

  @Post('auth/otp/request')
  requestOtp(@Body() body: SalesPartnerOtpDto) {
    return this.salesPartners.requestLoginOtp(body.phone);
  }

  @Post('auth/otp/verify')
  verifyOtp(@Body() body: SalesPartnerOtpVerifyDto) {
    return this.salesPartners.verifyLoginOtp(body.phone, body.code);
  }

  @Post('auth/login')
  login(@Body() body: SalesPartnerPasswordLoginDto) {
    return this.salesPartners.loginWithPassword(body.phone, body.password);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(SALES_PARTNER_ACTING_ROLE)
  @ApiBearerAuth()
  me(@Req() req: { user?: { purpose?: string; salesPartnerId?: string } }) {
    if (!isSalesPartnerPurpose(req.user?.purpose) || !req.user?.salesPartnerId) {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }
    return this.salesPartners.me(req.user.salesPartnerId);
  }
}

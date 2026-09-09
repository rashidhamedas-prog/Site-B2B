import { Controller, ForbiddenException, Get, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VENDOR_ROLE } from './vendor-policy';
import { VendorService } from './vendor.service';
import { VendorLedgerService } from './vendor-ledger.service';

type Authed = Express.Request & {
  user: { sub: string; role: string; purpose?: string; vendorId?: string };
};

@ApiTags('partners')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(VENDOR_ROLE)
@Controller({ path: 'partners', version: '1' })
export class PartnerController {
  constructor(
    private readonly vendors: VendorService,
    private readonly ledger: VendorLedgerService,
  ) {}

  private vendorId(req: Authed): string {
    if (req.user.purpose !== 'vendor' || !req.user.vendorId) {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }
    return req.user.vendorId;
  }

  @Get('me')
  @ApiOperation({ summary: 'حساب همکار جاری — فقط خود' })
  me(@Request() req: Authed) {
    if (req.user.purpose !== 'vendor') {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }
    return this.vendors.getMe(req.user.sub, req.user.vendorId);
  }

  @Get('ledger')
  @ApiOperation({ summary: 'دفتر کمیسیون همکار — فقط ردیف خودش' })
  ledgerSummary(@Request() req: Authed) {
    return this.ledger.summaryForVendor(this.vendorId(req));
  }
}

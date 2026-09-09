import { Controller, ForbiddenException, Get, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VENDOR_ROLE } from './vendor-policy';
import { VendorService } from './vendor.service';

type Authed = Express.Request & {
  user: { sub: string; role: string; purpose?: string; vendorId?: string };
};

@ApiTags('partners')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(VENDOR_ROLE)
@Controller({ path: 'partners', version: '1' })
export class PartnerController {
  constructor(private readonly vendors: VendorService) {}

  @Get('me')
  @ApiOperation({ summary: 'حساب همکار جاری — فقط خود' })
  me(@Request() req: Authed) {
    if (req.user.purpose !== 'vendor') {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }
    return this.vendors.getMe(req.user.sub, req.user.vendorId);
  }
}

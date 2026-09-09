import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VENDOR_ROLE } from '../vendor/vendor-policy';
import { FulfillmentService } from './fulfillment.service';

type Authed = Express.Request & {
  user: { sub: string; role: string; purpose?: string; vendorId?: string };
};

@ApiTags('partners')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(VENDOR_ROLE)
@Controller({ path: 'partners/fulfillments', version: '1' })
export class FulfillmentPartnerController {
  constructor(private readonly fulfillments: FulfillmentService) {}

  private vendorId(req: Authed): string {
    if (req.user.purpose !== 'vendor' || !req.user.vendorId) {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }
    return req.user.vendorId;
  }

  @Get()
  @ApiOperation({ summary: 'مرسوله‌های همکار جاری — فقط ردیف خودش' })
  list(@Request() req: Authed) {
    return this.fulfillments.listForVendor(this.vendorId(req));
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'قبول مرسوله توسط همکار مالک' })
  accept(@Request() req: Authed, @Param('id') id: string) {
    return this.fulfillments.acceptForVendor(id, this.vendorId(req));
  }

  @Patch(':id/ship')
  @ApiOperation({ summary: 'ثبت ارسال مرسوله + کد رهگیری توسط همکار مالک' })
  ship(
    @Request() req: Authed,
    @Param('id') id: string,
    @Body('trackingCode') trackingCode: string,
  ) {
    return this.fulfillments.shipForVendor(id, this.vendorId(req), trackingCode);
  }
}

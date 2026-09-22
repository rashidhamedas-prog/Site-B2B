import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SalesPartnerService } from './sales-partner.service';
import { PatchSalesPartnerStatusDto, ReviewSalesPartnerDto } from './dto/apply-sales-partner.dto';

@ApiTags('sales-partners-admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@AdminOnly()
@Controller({ path: 'admin/sales-partners', version: '1' })
export class SalesPartnerAdminController {
  constructor(private readonly salesPartners: SalesPartnerService) {}

  @Get('settings/public')
  settings() {
    return this.salesPartners.publicSettings();
  }

  @Get('applications')
  applications(@Query('status') status?: string) {
    return this.salesPartners.listApplications(status);
  }

  @Patch('applications/:id/review')
  review(
    @Param('id') id: string,
    @Body() body: ReviewSalesPartnerDto,
    @Req() req: { user?: { sub?: string; id?: string } },
  ) {
    return this.salesPartners.reviewApplication(id, req.user?.sub || req.user?.id || '', body.action, body.reason);
  }

  @Get()
  list() {
    return this.salesPartners.listPartners();
  }

  @Patch(':id/status')
  status(
    @Param('id') id: string,
    @Body() body: PatchSalesPartnerStatusDto,
    @Req() req: { user?: { sub?: string; id?: string } },
  ) {
    return this.salesPartners.patchProfileStatus(id, req.user?.sub || req.user?.id || '', body.status, body.reason);
  }
}

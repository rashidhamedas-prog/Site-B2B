import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SalesPartnerService } from './sales-partner.service';
import { SalesPartnerCatalogService } from './sales-partner-catalog.service';
import { PatchSalesPartnerStatusDto, ReviewSalesPartnerDto } from './dto/apply-sales-partner.dto';
import {
  CreateSalesCommissionRuleDto,
  PreviewSalesCommissionDto,
  SetSalesPartnerEligibilityDto,
} from './dto/sales-partner-catalog.dto';

@ApiTags('sales-partners-admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@AdminOnly()
@Controller({ path: 'admin/sales-partners', version: '1' })
export class SalesPartnerAdminController {
  constructor(
    private readonly salesPartners: SalesPartnerService,
    private readonly catalog: SalesPartnerCatalogService,
  ) {}

  @Get('settings/public')
  settings() {
    return this.salesPartners.publicSettings();
  }

  @Get('catalog')
  catalogCandidates(@Query('q') q?: string, @Query('page') page?: string) {
    return this.catalog.adminCandidates(q, Number(page) || 1);
  }

  @Patch('catalog/:productId/eligibility')
  setEligibility(
    @Param('productId') productId: string,
    @Body() body: SetSalesPartnerEligibilityDto,
    @Req() req: { user?: { sub?: string; id?: string } },
  ) {
    return this.catalog.setEligibility(productId, req.user?.sub || req.user?.id || '', body);
  }

  @Get('rules')
  rules() {
    return this.catalog.listRules();
  }

  @Post('rules')
  createRule(
    @Body() body: CreateSalesCommissionRuleDto,
    @Req() req: { user?: { sub?: string; id?: string } },
  ) {
    return this.catalog.createRule(req.user?.sub || req.user?.id || '', body);
  }

  @Post('rules/preview')
  preview(@Body() body: PreviewSalesCommissionDto) {
    return this.catalog.preview(body.salesPartnerId, body.productId, body.lineTotalIrr);
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

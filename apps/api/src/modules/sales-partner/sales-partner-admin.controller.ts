import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SalesPartnerService } from './sales-partner.service';
import { SalesPartnerCatalogService } from './sales-partner-catalog.service';
import { SalesPartnerPayoutService } from './sales-partner-payout.service';
import { SalesPartnerLedgerService } from './sales-partner-ledger.service';
import { SalesPartnerDraftService } from './sales-partner-draft.service';
import { PatchSalesPartnerStatusDto, ReviewSalesPartnerDto } from './dto/apply-sales-partner.dto';
import { ChangeSalesPartnerAttributionDto } from './dto/sales-partner-draft.dto';
import { PatchSalesPartnerSettingsDto } from './dto/sales-partner-settings.dto';
import { ConfirmSalesPartnerPayoutDto } from './dto/sales-partner-payout.dto';
import {
  CreateSalesCommissionRuleDto,
  PreviewSalesCommissionDto,
  SetSalesPartnerEligibilityDto,
} from './dto/sales-partner-catalog.dto';
import { PublishSalesPartnerNoticeDto } from './dto/sales-partner-notice.dto';
import { SalesPartnerNoticeService } from './sales-partner-notice.service';

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
    private readonly payouts: SalesPartnerPayoutService,
    private readonly ledger: SalesPartnerLedgerService,
    private readonly drafts: SalesPartnerDraftService,
    private readonly notices: SalesPartnerNoticeService,
  ) {}

  @Get('notices')
  listNotices() {
    return this.notices.listAdmin();
  }

  @Post('notices')
  publishNotice(
    @Body() body: PublishSalesPartnerNoticeDto,
    @Req() req: { user?: { sub?: string; id?: string } },
  ) {
    return this.notices.publish(req.user?.sub || req.user?.id || '', body);
  }

  @Post('notices/:id/archive')
  archiveNotice(@Param('id') id: string) {
    return this.notices.archive(id);
  }

  @Get('settings/public')
  settings() {
    return this.salesPartners.publicSettings();
  }

  @Get('settings')
  adminSettings() {
    return this.salesPartners.adminSettings();
  }

  @Patch('settings')
  patchSettings(
    @Body() body: PatchSalesPartnerSettingsDto,
    @Req() req: { user?: { sub?: string; id?: string } },
  ) {
    return this.salesPartners.updateSettings(req.user?.sub || req.user?.id || '', { ...body });
  }

  @Get('orders')
  adminOrders(@Query('salesPartnerId') salesPartnerId?: string) {
    return this.drafts.listAdmin(salesPartnerId);
  }

  @Get('orders/:id')
  adminOrder(@Param('id') id: string) {
    return this.drafts.getAdmin(id);
  }

  @Patch('orders/:id/attribution')
  changeAttribution(
    @Param('id') id: string,
    @Body() body: ChangeSalesPartnerAttributionDto,
    @Req() req: { user?: { sub?: string; id?: string } },
  ) {
    return this.drafts.adminChangeAttribution(
      id,
      body.salesPartnerId,
      body.reason,
      req.user?.sub || req.user?.id || '',
    );
  }

  @Get('audits')
  audits(@Query('targetType') targetType?: string) {
    return this.salesPartners.listAudits(targetType);
  }

  @Get('reports')
  async reports() {
    const [base, drafts, commissions, payoutRows] = await Promise.all([
      this.salesPartners.programReport(),
      this.drafts.adminStats(),
      this.ledger.programBalances(),
      this.payouts.listAdmin(),
    ]);
    const paidIrr = payoutRows
      .filter((row) => row.status === 'PAID')
      .reduce((sum, row) => sum + Number(row.amountIrr || 0), 0);
    return {
      ...base,
      drafts,
      commissions: {
        held: commissions.held,
        available: commissions.available,
        paid: commissions.paid,
        reversed: commissions.reversed,
        debt: commissions.debt,
        byPartner: commissions.byPartner,
        sampleSize: commissions.sampleSize,
      },
      payouts: {
        count: payoutRows.length,
        paidIrr,
      },
    };
  }

  @Get('catalog')
  catalogCandidates(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('categoryId') categoryId?: string,
    @Query('eligible') eligible?: string,
  ) {
    return this.catalog.adminCandidates(q, Number(page) || 1, categoryId, eligible);
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
    const actorId = req.user?.sub || req.user?.id || '';
    if (body.scope === 'PROGRAM') {
      return this.catalog.setProgramRate(actorId, body.percent, body.note, body.applyToFollowerProducts !== false);
    }
    return this.catalog.createRule(actorId, body);
  }

  @Post('rules/preview')
  preview(@Body() body: PreviewSalesCommissionDto) {
    return this.catalog.preview(body.salesPartnerId, body.productId, body.lineTotalIrr);
  }

  @Get('applications')
  applications(@Query('status') status?: string) {
    return this.salesPartners.listApplications(status);
  }

  @Get('applications/:id')
  applicationDetail(@Param('id') id: string) {
    return this.salesPartners.getApplication(id);
  }

  @Patch('applications/:id/review')
  review(
    @Param('id') id: string,
    @Body() body: ReviewSalesPartnerDto,
    @Req() req: { user?: { sub?: string; id?: string } },
  ) {
    return this.salesPartners.reviewApplication(id, req.user?.sub || req.user?.id || '', body.action, body.reason);
  }

  @Post('applications/:id/welcome-sms')
  sendWelcomeSms(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; id?: string } },
  ) {
    return this.salesPartners.sendWelcomeCredentialsSms(id, req.user?.sub || req.user?.id || '');
  }

  @Get('payouts')
  listPayouts(@Query('salesPartnerId') salesPartnerId?: string) {
    return this.payouts.listAdmin(salesPartnerId);
  }

  @Post('payouts')
  confirmPayout(
    @Body() body: ConfirmSalesPartnerPayoutDto,
    @Req() req: { user?: { sub?: string; id?: string } },
  ) {
    return this.payouts.confirm(req.user?.sub || req.user?.id || '', body);
  }

  @Get(':id/balances')
  balances(@Param('id') id: string) {
    return this.ledger.balances(id);
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

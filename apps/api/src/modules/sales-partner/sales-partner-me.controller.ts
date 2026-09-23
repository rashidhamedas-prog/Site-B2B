import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SALES_PARTNER_ACTING_ROLE, isSalesPartnerPurpose } from './sales-partner-policy';
import { SalesPartnerCatalogService } from './sales-partner-catalog.service';
import { SalesPartnerDraftService } from './sales-partner-draft.service';
import { SalesPartnerLedgerService } from './sales-partner-ledger.service';
import { SalesPartnerPayoutService } from './sales-partner-payout.service';
import { SalesPartnerService } from './sales-partner.service';
import { CreateSalesPartnerDraftDto, PatchSalesPartnerDraftDto } from './dto/sales-partner-draft.dto';
import { PatchSalesPartnerIbanDto } from './dto/sales-partner-payout.dto';

@ApiTags('sales-partners')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(SALES_PARTNER_ACTING_ROLE)
@Controller({ path: 'sales-partners', version: '1' })
export class SalesPartnerMeController {
  constructor(
    private readonly catalog: SalesPartnerCatalogService,
    private readonly drafts: SalesPartnerDraftService,
    private readonly ledger: SalesPartnerLedgerService,
    private readonly payoutsSvc: SalesPartnerPayoutService,
    private readonly salesPartners: SalesPartnerService,
  ) {}

  @Get('catalog')
  catalogList(
    @Req() req: { user?: { purpose?: string; salesPartnerId?: string } },
    @Query('page') page?: string,
  ) {
    const salesPartnerId = this.requirePartner(req);
    return this.catalog.partnerCatalog(salesPartnerId, Number(page) || 1);
  }

  @Get('catalog/:productId')
  catalogOne(
    @Req() req: { user?: { purpose?: string; salesPartnerId?: string } },
    @Param('productId') productId: string,
  ) {
    const salesPartnerId = this.requirePartner(req);
    return this.catalog.partnerProduct(salesPartnerId, productId);
  }

  @Get('order-drafts')
  listDrafts(@Req() req: { user?: { purpose?: string; salesPartnerId?: string } }) {
    return this.drafts.listMine(this.requirePartner(req));
  }

  @Post('order-drafts')
  createDraft(
    @Req() req: { user?: { purpose?: string; salesPartnerId?: string } },
    @Body() body: CreateSalesPartnerDraftDto,
  ) {
    return this.drafts.create(this.requirePartner(req), body);
  }

  @Get('order-drafts/:id')
  getDraft(
    @Req() req: { user?: { purpose?: string; salesPartnerId?: string } },
    @Param('id') id: string,
  ) {
    return this.drafts.getMine(this.requirePartner(req), id);
  }

  @Patch('order-drafts/:id')
  patchDraft(
    @Req() req: { user?: { purpose?: string; salesPartnerId?: string } },
    @Param('id') id: string,
    @Body() body: PatchSalesPartnerDraftDto,
  ) {
    return this.drafts.patch(this.requirePartner(req), id, body);
  }

  @Post('order-drafts/:id/request-confirmation')
  requestConfirmation(
    @Req() req: { user?: { purpose?: string; salesPartnerId?: string } },
    @Param('id') id: string,
  ) {
    return this.drafts.requestConfirmation(this.requirePartner(req), id);
  }

  @Post('order-drafts/:id/cancel')
  cancelDraft(
    @Req() req: { user?: { purpose?: string; salesPartnerId?: string } },
    @Param('id') id: string,
  ) {
    return this.drafts.cancel(this.requirePartner(req), id);
  }

  @Get('orders')
  listOrders(@Req() req: { user?: { purpose?: string; salesPartnerId?: string } }) {
    return this.drafts.listMine(this.requirePartner(req));
  }

  @Get('orders/:id')
  getOrder(
    @Req() req: { user?: { purpose?: string; salesPartnerId?: string } },
    @Param('id') id: string,
  ) {
    return this.drafts.getMine(this.requirePartner(req), id);
  }

  @Get('commissions')
  commissions(@Req() req: { user?: { purpose?: string; salesPartnerId?: string } }) {
    return this.ledger.balances(this.requirePartner(req));
  }

  @Get('ledger')
  ledgerView(@Req() req: { user?: { purpose?: string; salesPartnerId?: string } }) {
    return this.ledger.balances(this.requirePartner(req));
  }

  @Get('payouts')
  payouts(@Req() req: { user?: { purpose?: string; salesPartnerId?: string } }) {
    return this.payoutsSvc.listMine(this.requirePartner(req));
  }

  @Patch('me/iban')
  updateIban(
    @Req() req: { user?: { purpose?: string; salesPartnerId?: string } },
    @Body() body: PatchSalesPartnerIbanDto,
  ) {
    return this.salesPartners.updateIban(this.requirePartner(req), body.iban);
  }

  private requirePartner(req: { user?: { purpose?: string; salesPartnerId?: string } }) {
    if (!isSalesPartnerPurpose(req.user?.purpose) || !req.user?.salesPartnerId) {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }
    return req.user.salesPartnerId;
  }
}

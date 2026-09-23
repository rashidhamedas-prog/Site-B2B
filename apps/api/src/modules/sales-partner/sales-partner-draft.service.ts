import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThan, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ProductEntity } from '../product/entities/product.entity';
import { ProductVariantEntity } from '../product/entities/product-variant.entity';
import { NotificationService } from '../notification/notification.service';
import { CustomerService } from '../customer/customer.service';
import { OrderService } from '../order/order.service';
import { OrderEntity } from '../order/entities/order.entity';
import { ShippingService } from '../shipping/shipping.service';
import { AppSettingEntity } from '../settings/entities/app-setting.entity';
import { resolveCashOnDeliveryFlags } from '../settings/settings-payment-cash';
import { normalizePhone } from '../auth/phone.util';
import {
  SalesCommissionLedgerEntryEntity,
  SalesPartnerOrderDraftEntity,
  SalesPartnerOrderDraftItemEntity,
  SalesPartnerProfileEntity,
} from './entities';
import { SalesPartnerService } from './sales-partner.service';
import { SalesPartnerCatalogService } from './sales-partner-catalog.service';
import {
  canTransitionDraft,
  confirmActionGone,
  confirmationSmsText,
  confirmPageGone,
  draftItemFreshness,
  hashConfirmationToken,
  humanDraftFreshness,
  humanDraftStatus,
  humanPartnerOrderStatus,
  isBlockedSelfReferral,
  isDraftExpired,
  partnerCommissionOverlay,
  resendBlockedReason,
  resolveConfirmPaymentMethod,
  smsFailureBlocksSend,
  maskCustomerPhone,
  priceDriftBps,
} from './sales-partner-draft-policy';
import { canSalesPartnerCreateDraft } from './sales-partner-policy';
import { programAllowsPartnerAction } from './sales-partner-settings';
import { SALES_PARTNER_EVENT } from './sales-partner-events';
import { commissionAmountIrr, selectCommissionRule } from './sales-commission-policy';
import { canAdminChangeAttribution, partnerOrderAttribution } from './sales-partner-attribution';

type DraftItemInput = { productId: string; variantId?: string; quantity: number };

@Injectable()
export class SalesPartnerDraftService {
  constructor(
    @InjectRepository(SalesPartnerOrderDraftEntity)
    private readonly drafts: Repository<SalesPartnerOrderDraftEntity>,
    @InjectRepository(SalesPartnerOrderDraftItemEntity)
    private readonly items: Repository<SalesPartnerOrderDraftItemEntity>,
    @InjectRepository(SalesPartnerProfileEntity)
    private readonly profiles: Repository<SalesPartnerProfileEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(ProductVariantEntity)
    private readonly variants: Repository<ProductVariantEntity>,
    @InjectRepository(AppSettingEntity)
    private readonly settingsRepo: Repository<AppSettingEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRows: Repository<OrderEntity>,
    @InjectRepository(SalesCommissionLedgerEntryEntity)
    private readonly ledger: Repository<SalesCommissionLedgerEntryEntity>,
    private readonly program: SalesPartnerService,
    private readonly catalog: SalesPartnerCatalogService,
    private readonly customers: CustomerService,
    private readonly orders: OrderService,
    private readonly shipping: ShippingService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  async create(salesPartnerId: string, input: { items: DraftItemInput[]; customerPhone?: string; customerName?: string }) {
    const profile = await this.requireActivePartner(salesPartnerId);
    const settings = await this.program.settings();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayCount = await this.drafts.count({ where: { salesPartnerId, createdAt: MoreThan(since) } });
    if (todayCount >= settings.dailyDraftCap) {
      throw new ForbiddenException('سقف ساخت پیش‌سفارش امروز پر شده است');
    }
    const priced = await this.priceItems(salesPartnerId, input.items);
    const draft = this.drafts.create({
      salesPartnerId,
      status: 'DRAFT',
      customerPhone: input.customerPhone ? this.assertCustomerPhone(input.customerPhone, profile.phone, settings.blockSelfReferral) : null,
      customerPhoneHash: input.customerPhone ? this.phoneHash(input.customerPhone) : null,
      customerName: input.customerName?.trim().slice(0, 80) || null,
      merchandiseIrr: priced.merchandiseIrr,
      estimatedCommissionIrr: priced.estimatedCommissionIrr,
      shippingFeeIrr: 0,
      expiresAt: new Date(Date.now() + settings.draftTtlHours * 3600 * 1000),
    });
    await this.drafts.save(draft);
    await this.replaceItems(draft.id, priced.rows);
    return this.toPartnerView(draft.id, salesPartnerId);
  }

  async patch(salesPartnerId: string, draftId: string, input: { items?: DraftItemInput[]; customerPhone?: string; customerName?: string }) {
    const draft = await this.ownedDraft(salesPartnerId, draftId);
    if (!['DRAFT', 'AWAITING_CUSTOMER_CONFIRMATION'].includes(draft.status)) {
      throw new ConflictException('این پیش‌سفارش دیگر قابل ویرایش نیست');
    }
    const profile = await this.requireActivePartner(salesPartnerId);
    const settings = await this.program.settings();
    if (input.items) {
      const priced = await this.priceItems(salesPartnerId, input.items);
      draft.merchandiseIrr = priced.merchandiseIrr;
      draft.estimatedCommissionIrr = priced.estimatedCommissionIrr;
      await this.replaceItems(draft.id, priced.rows);
    }
    if (input.customerPhone) {
      draft.customerPhone = this.assertCustomerPhone(input.customerPhone, profile.phone, settings.blockSelfReferral);
      draft.customerPhoneHash = this.phoneHash(input.customerPhone);
    }
    if (input.customerName !== undefined) draft.customerName = input.customerName?.trim().slice(0, 80) || null;
    if (draft.status === 'AWAITING_CUSTOMER_CONFIRMATION' && canTransitionDraft(draft.status, 'DRAFT')) {
      draft.status = 'DRAFT';
      draft.confirmationTokenHash = null;
    }
    await this.drafts.save(draft);
    return this.toPartnerView(draft.id, salesPartnerId);
  }

  async requestConfirmation(salesPartnerId: string, draftId: string) {
    const profile = await this.requireActivePartner(salesPartnerId);
    const settings = await this.program.settings();
    const draft = await this.ownedDraft(salesPartnerId, draftId);
    await this.expireIfNeeded(draft);
    if (!['DRAFT', 'AWAITING_CUSTOMER_CONFIRMATION'].includes(draft.status)) {
      throw new ConflictException('برای این پیش‌سفارش نمی‌توان لینک تأیید فرستاد');
    }
    if (!draft.customerPhone) throw new BadRequestException('شماره مشتری لازم است');
    const resendBlock = resendBlockedReason(
      draft.lastSentAt,
      draft.sentCount,
      new Date(),
      settings.confirmResendCooldownSeconds,
      settings.confirmResendDailyCap,
    );
    if (resendBlock === 'COOLDOWN') throw new ForbiddenException('ارسال دوباره هنوز ممکن نیست');
    if (resendBlock === 'DAILY_CAP') throw new ForbiddenException('سقف ارسال پیامک امروز پر شده است');
    const existingItems = await this.items.find({ where: { draftId: draft.id } });
    const priced = await this.priceItems(salesPartnerId, existingItems.map((row) => ({
      productId: row.productId,
      variantId: row.variantId || undefined,
      quantity: row.quantity,
    })));
    this.assertPriceStable(existingItems, priced.rows, settings.priceDriftMaxBps);
    await this.replaceItems(draft.id, priced.rows);
    draft.merchandiseIrr = priced.merchandiseIrr;
    draft.estimatedCommissionIrr = priced.estimatedCommissionIrr;
    const token = randomBytes(32).toString('base64url');
    draft.confirmationTokenHash = hashConfirmationToken(token);
    draft.status = 'AWAITING_CUSTOMER_CONFIRMATION';
    draft.expiresAt = new Date(Date.now() + settings.draftTtlHours * 3600 * 1000);
    draft.sentCount += 1;
    draft.lastSentAt = new Date();
    await this.drafts.save(draft);
    const origin = (process.env.NEXT_PUBLIC_RETAIL_URL || 'https://www.poshaktaranom.ir').replace(/\/$/, '');
    const confirmUrl = `${origin}/confirm/sales-partner/${token}`;
    const sms = confirmationSmsText(profile.displayName, confirmUrl);
    const sent = this.notifications ? await this.notifications.sendSms(draft.customerPhone, sms) : false;
    if (smsFailureBlocksSend(this.config.get('NODE_ENV'), sent)) {
      throw new BadRequestException('ارسال پیامک ناموفق بود. کمی بعد دوباره تلاش کنید');
    }
    await this.program.emitEvent(SALES_PARTNER_EVENT.CONFIRMATION_REQUESTED, draft.id, {
      draftId: draft.id,
      profileId: salesPartnerId,
      status: draft.status,
    });
    return {
      ...(await this.toPartnerView(draft.id, salesPartnerId)),
      cooldownSeconds: settings.confirmResendCooldownSeconds,
      ...(this.config.get('NODE_ENV') !== 'production' ? { devConfirmPath: `/confirm/sales-partner/${token}` } : {}),
    };
  }

  async adminStats() {
    const rows = await this.drafts.find({ take: 500, order: { createdAt: 'DESC' } });
    const byStatus = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});
    const converted = byStatus.CONVERTED_TO_ORDER || 0;
    const decided = converted
      + (byStatus.REJECTED_BY_CUSTOMER || 0)
      + (byStatus.EXPIRED || 0)
      + (byStatus.CANCELLED || 0);
    return {
      sampleSize: rows.length,
      byStatus,
      converted,
      customerConfirmRate: decided > 0 ? Number((converted / decided).toFixed(3)) : null,
    };
  }

  async listAdmin(salesPartnerId?: string) {
    const rows = await this.drafts.find({
      where: salesPartnerId ? { salesPartnerId } : {},
      order: { updatedAt: 'DESC' },
      take: 100,
    });
    const orderIds = [...new Set(rows.map((row) => row.convertedOrderId).filter((id): id is string => !!id))];
    const orders = orderIds.length
      ? await this.orderRows.find({
          where: { id: In(orderIds) },
          select: ['id', 'status', 'salesSource', 'salesPartnerId', 'salesPartnerSubmissionId'],
        })
      : [];
    const statusById = new Map(orders.map((order) => [order.id, order.status]));
    const attributionById = new Map(
      orders.map((order) => [order.id, {
        salesSource: order.salesSource,
        salesPartnerId: order.salesPartnerId,
        salesPartnerSubmissionId: order.salesPartnerSubmissionId,
      }]),
    );
    const ledgerRows = orderIds.length
      ? await this.ledger.find({
          where: { orderId: In(orderIds), entryType: In(['COMMISSION_EARNED', 'PAYOUT']) },
        })
      : [];
    const now = new Date();
    return rows.map((row) => {
      const orderStatus = row.convertedOrderId ? statusById.get(row.convertedOrderId) ?? null : null;
      const overlay = partnerCommissionOverlay(
        orderStatus,
        ledgerRows.filter((entry) => entry.orderId === row.convertedOrderId),
        now,
      );
      return {
        id: row.id,
        salesPartnerId: row.salesPartnerId,
        status: row.status,
        orderStatus,
        statusLabel: humanPartnerOrderStatus(row.status, orderStatus, overlay),
        merchandiseIrr: row.merchandiseIrr,
        estimatedCommissionIrr: row.estimatedCommissionIrr,
        convertedOrderId: row.convertedOrderId,
        customerPhoneMasked: maskCustomerPhone(row.customerPhone),
        attribution: row.convertedOrderId ? attributionById.get(row.convertedOrderId) ?? null : null,
        updatedAt: row.updatedAt,
      };
    });
  }

  async adminChangeAttribution(
    draftId: string,
    nextPartnerId: string,
    reason: string,
    actorUserId: string,
  ) {
    const draft = await this.drafts.findOne({ where: { id: draftId } });
    if (!draft?.convertedOrderId) throw new NotFoundException('سفارش تبدیل‌شده پیدا نشد');
    const next = await this.profiles.findOne({ where: { id: nextPartnerId } });
    const earned = await this.ledger.count({
      where: { orderId: draft.convertedOrderId, entryType: 'COMMISSION_EARNED' },
    });
    const allowed = canAdminChangeAttribution({
      reason,
      hasEarnedCommission: earned > 0,
      nextPartnerActive: next?.status === 'ACTIVE',
    });
    if (allowed.ok === false) throw new ConflictException(allowed.message);
    await this.orderRows.update(draft.convertedOrderId, partnerOrderAttribution({
      draftId: draft.id,
      salesPartnerId: nextPartnerId,
    }));
    await this.program.recordAudit(actorUserId, 'order.attribution_changed', 'order', draft.convertedOrderId, {
      draftId: draft.id,
      fromPartnerId: draft.salesPartnerId,
      toPartnerId: nextPartnerId,
      reason: reason.trim(),
    });
    return {
      orderId: draft.convertedOrderId,
      salesPartnerId: nextPartnerId,
      salesSource: 'SALES_PARTNER',
    };
  }

  async cancel(salesPartnerId: string, draftId: string) {
    const draft = await this.ownedDraft(salesPartnerId, draftId);
    if (!canTransitionDraft(draft.status, 'CANCELLED')) {
      throw new ConflictException('این پیش‌سفارش قابل لغو نیست');
    }
    draft.status = 'CANCELLED';
    draft.confirmationTokenHash = null;
    await this.drafts.save(draft);
    return this.toPartnerView(draft.id, salesPartnerId);
  }

  async listMine(salesPartnerId: string) {
    const rows = await this.drafts.find({ where: { salesPartnerId }, order: { createdAt: 'DESC' }, take: 50 });
    return Promise.all(rows.map((row) => this.toPartnerView(row.id, salesPartnerId)));
  }

  async getMine(salesPartnerId: string, draftId: string) {
    return this.toPartnerView(draftId, salesPartnerId);
  }

  async publicByToken(token: string) {
    const draft = await this.draftByToken(token);
    await this.expireIfNeeded(draft);
    if (confirmPageGone(draft.status)) {
      throw new GoneException('این لینک دیگر معتبر نیست');
    }
    const profile = await this.profiles.findOne({ where: { id: draft.salesPartnerId } });
    const items = await this.items.find({ where: { draftId: draft.id } });
    const payment = await this.settingsRepo.findOne({ where: { key: 'payment' } });
    const cash = resolveCashOnDeliveryFlags(payment?.value).retailCashEnabled;
    const quote = await this.shipping.quote({
      pieces: items.reduce((sum, row) => sum + row.quantity, 0),
      orderTotal: draft.merchandiseIrr,
      channel: 'RETAIL',
    });
    draft.shippingFeeIrr = Number(quote.fee || 0);
    await this.drafts.save(draft);
    return {
      seller: 'ترنم',
      partnerDisplayName: profile?.displayName || 'همکار فروش',
      status: draft.status,
      statusLabel: humanDraftStatus(draft.status),
      expiresAt: draft.expiresAt,
      merchandiseIrr: draft.merchandiseIrr,
      shippingFeeIrr: draft.shippingFeeIrr,
      items: items.map((row) => ({
        name: row.productName,
        quantity: row.quantity,
        unitPriceIrr: row.unitPriceIrr,
        lineTotalIrr: row.lineTotalIrr,
      })),
      cashEnabled: cash,
      notice: 'تا زمانی که خودتان تأیید نکنید سفارشی ثبت یا مبلغی دریافت نمی‌شود. فروشنده اصلی ترنم است.',
    };
  }

  async confirmByToken(token: string, input: {
    recipientName: string;
    province: string;
    city: string;
    address: string;
    postalCode?: string;
    paymentMethod?: 'ONLINE' | 'CASH';
    consent: boolean;
  }) {
    if (!input.consent) throw new BadRequestException('رضایت مشتری برای ثبت سفارش لازم است');
    const draft = await this.draftByToken(token);
    await this.expireIfNeeded(draft);
    if (draft.status === 'CONVERTED_TO_ORDER' && draft.convertedOrderId) {
      return { orderId: draft.convertedOrderId, status: 'CONVERTED_TO_ORDER' };
    }
    if (confirmActionGone(draft.status)) {
      throw new GoneException('این لینک دیگر معتبر نیست');
    }
    const profile = await this.profiles.findOne({ where: { id: draft.salesPartnerId } });
    if (!profile || !canSalesPartnerCreateDraft(profile.status)) {
      throw new ForbiddenException('این همکار فعلاً نمی‌تواند سفارش بسازد');
    }
    const payment = await this.settingsRepo.findOne({ where: { key: 'payment' } });
    const cash = resolveCashOnDeliveryFlags(payment?.value).retailCashEnabled;
    const paymentMethod = resolveConfirmPaymentMethod(input.paymentMethod, cash);
    const items = await this.items.find({ where: { draftId: draft.id } });
    const priced = await this.priceItems(draft.salesPartnerId, items.map((row) => ({
      productId: row.productId,
      variantId: row.variantId || undefined,
      quantity: row.quantity,
    })));
    const settings = await this.program.settings();
    this.assertPriceStable(items, priced.rows, settings.priceDriftMaxBps);
    if (!draft.customerPhone) throw new BadRequestException('شماره مشتری نامعتبر است');
    const customer = await this.ensureRetailCustomer(draft.customerPhone, input.recipientName, input.province, input.city, input.address);
    const created = await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(SalesPartnerOrderDraftEntity, {
        where: { id: draft.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException();
      if (locked.convertedOrderId) return { orderId: locked.convertedOrderId };
      if (!canTransitionDraft(locked.status, 'CUSTOMER_CONFIRMED') && locked.status !== 'CUSTOMER_CONFIRMED') {
        throw new ConflictException('این پیش‌سفارش قابل تأیید نیست');
      }
      locked.status = 'CUSTOMER_CONFIRMED';
      await manager.save(locked);
      const order = await this.orders.create({
        customerId: customer.id,
        channel: 'RETAIL',
        type: 'RETAIL_WEBSITE',
        paymentMethod,
        idempotencyKey: `sp-draft:${locked.id}`,
        shippingAddress: {
          recipientName: input.recipientName,
          province: input.province,
          city: input.city,
          address: input.address,
          postalCode: input.postalCode || '',
          phone: draft.customerPhone,
        },
        notes: `salesPartner:${locked.salesPartnerId}`,
        items: priced.rows.map((row) => ({
          productId: row.productId,
          productVariantId: row.variantId || undefined,
          quantity: row.quantity,
        })),
      });
      await manager.update(OrderEntity, order.id, partnerOrderAttribution({
        draftId: locked.id,
        salesPartnerId: locked.salesPartnerId,
      }));
      locked.status = 'CONVERTED_TO_ORDER';
      locked.convertedOrderId = order.id;
      locked.confirmationTokenHash = null;
      await manager.save(locked);
      return { orderId: order.id };
    });
    await this.program.emitEvent(SALES_PARTNER_EVENT.CUSTOMER_CONFIRMED, draft.id, {
      draftId: draft.id,
      orderId: created.orderId,
      status: 'CONVERTED_TO_ORDER',
    });
    return { ...created, status: 'CONVERTED_TO_ORDER' };
  }

  async rejectByToken(token: string) {
    const draft = await this.draftByToken(token);
    if (!canTransitionDraft(draft.status, 'REJECTED_BY_CUSTOMER')) {
      throw new ConflictException('این سبد دیگر قابل رد نیست');
    }
    draft.status = 'REJECTED_BY_CUSTOMER';
    draft.confirmationTokenHash = null;
    await this.drafts.save(draft);
    await this.program.emitEvent(SALES_PARTNER_EVENT.CUSTOMER_REJECTED, draft.id, {
      draftId: draft.id,
      status: draft.status,
    });
    return { status: draft.status, statusLabel: humanDraftStatus(draft.status) };
  }

  private async priceItems(salesPartnerId: string, input: DraftItemInput[]) {
    const loadedRules = await this.catalog.loadRules();
    const rows = [];
    let merchandiseIrr = 0;
    let estimatedCommissionIrr = 0;
    for (const item of input) {
      const product = await this.products.findOne({ where: { id: item.productId, status: 'ACTIVE', showOnRetail: true } });
      if (!product) throw new BadRequestException('یکی از محصولات قابل فروش نیست');
      await this.catalog.partnerProduct(salesPartnerId, product.id);
      const qty = item.quantity;
      if (!Number.isInteger(qty) || qty < 1) throw new BadRequestException('تعداد نامعتبر است');
      let stock = product.retailStock;
      let variantId = item.variantId || null;
      if (variantId) {
        const variant = await this.variants.findOne({ where: { id: variantId, productId: product.id } });
        if (!variant) throw new BadRequestException('رنگ یا سایز انتخاب‌شده معتبر نیست');
        stock = variant.retailStock;
      }
      if (stock < qty) throw new ConflictException(`موجودی «${product.name}» کافی نیست`);
      const unitPriceIrr = Number(product.retailPrice || 0);
      if (!Number.isInteger(unitPriceIrr) || unitPriceIrr <= 0) throw new BadRequestException('قیمت محصول نامعتبر است');
      const lineTotalIrr = unitPriceIrr * qty;
      const rule = selectCommissionRule(loadedRules, {
        productId: product.id,
        categoryId: product.categoryId || null,
        lineTotalAfterDiscountIrr: lineTotalIrr,
      }, salesPartnerId, new Date());
      const percent = rule?.percent ?? 0;
      const commission = commissionAmountIrr(lineTotalIrr, percent);
      merchandiseIrr += lineTotalIrr;
      estimatedCommissionIrr += commission;
      rows.push({
        productId: product.id,
        variantId,
        quantity: qty,
        unitPriceIrr,
        lineTotalIrr,
        estimatedCommissionIrr: commission,
        commissionPercent: percent,
        ruleId: rule?.id ?? null,
        ruleVersion: rule?.version ?? 1,
        productName: product.name,
      });
    }
    return { rows, merchandiseIrr, estimatedCommissionIrr };
  }

  private async replaceItems(draftId: string, rows: {
    productId: string;
    variantId: string | null;
    quantity: number;
    unitPriceIrr: number;
    lineTotalIrr: number;
    estimatedCommissionIrr: number;
    commissionPercent: number;
    ruleId: string | null;
    ruleVersion: number;
    productName: string;
  }[]) {
    await this.items.delete({ draftId });
    await this.items.save(rows.map((row) => this.items.create({ ...row, draftId })));
  }

  private assertPriceStable(
    previous: SalesPartnerOrderDraftItemEntity[],
    next: { productId: string; variantId: string | null; unitPriceIrr: number }[],
    maxBps: number,
  ) {
    for (const row of previous) {
      const found = next.find((item) => item.productId === row.productId && item.variantId === row.variantId);
      if (!found) throw new ConflictException('یکی از اقلام دیگر قابل فروش نیست');
      if (priceDriftBps(row.unitPriceIrr, found.unitPriceIrr) > maxBps) {
        throw new ConflictException('قیمت محصول تغییر کرده است. سبد را دوباره بررسی کنید');
      }
    }
  }

  private async requireActivePartner(salesPartnerId: string) {
    const profile = await this.profiles.findOne({ where: { id: salesPartnerId } });
    if (!profile || !canSalesPartnerCreateDraft(profile.status)) {
      throw new ForbiddenException('فقط همکار فعال می‌تواند سفارش بسازد');
    }
    const settings = await this.program.settings();
    if (!programAllowsPartnerAction(settings, profile.phone)) {
      throw new ForbiddenException('برنامه همکاری فعلاً فعال نیست');
    }
    return profile;
  }

  private async ownedDraft(salesPartnerId: string, draftId: string) {
    const draft = await this.drafts.findOne({ where: { id: draftId, salesPartnerId } });
    if (!draft) throw new NotFoundException('پیش‌سفارش پیدا نشد');
    await this.expireIfNeeded(draft);
    return draft;
  }

  private async draftByToken(token: string) {
    if (!token || token.length < 16) throw new NotFoundException('لینک تأیید معتبر نیست');
    const draft = await this.drafts.findOne({ where: { confirmationTokenHash: hashConfirmationToken(token) } });
    if (!draft) throw new NotFoundException('لینک تأیید معتبر نیست');
    return draft;
  }

  private async expireIfNeeded(draft: SalesPartnerOrderDraftEntity) {
    if (isDraftExpired(draft.expiresAt, new Date()) && canTransitionDraft(draft.status, 'EXPIRED')) {
      draft.status = 'EXPIRED';
      draft.customerPhone = null;
      draft.customerName = null;
      draft.confirmationTokenHash = null;
      await this.drafts.save(draft);
      await this.program.emitEvent(SALES_PARTNER_EVENT.DRAFT_EXPIRED, draft.id, {
        draftId: draft.id,
        status: 'EXPIRED',
      });
    }
  }

  private async toPartnerView(draftId: string, salesPartnerId: string) {
    const draft = await this.ownedDraft(salesPartnerId, draftId);
    const items = await this.items.find({ where: { draftId } });
    let orderStatus: string | null = null;
    let overlay: ReturnType<typeof partnerCommissionOverlay> = null;
    if (draft.convertedOrderId) {
      const order = await this.orderRows.findOne({
        where: { id: draft.convertedOrderId },
        select: ['id', 'status'],
      });
      orderStatus = order?.status ?? null;
      const ledgerRows = await this.ledger.find({
        where: { orderId: draft.convertedOrderId, entryType: In(['COMMISSION_EARNED', 'PAYOUT']) },
      });
      overlay = partnerCommissionOverlay(orderStatus, ledgerRows, new Date());
    }
    const productIds = [...new Set(items.map((row) => row.productId))];
    const variantIds = [...new Set(items.map((row) => row.variantId).filter((id): id is string => !!id))];
    const products = productIds.length
      ? await this.products.find({ where: { id: In(productIds) }, select: ['id', 'retailPrice', 'retailStock', 'status', 'showOnRetail'] })
      : [];
    const variants = variantIds.length
      ? await this.variants.find({ where: { id: In(variantIds) }, select: ['id', 'retailStock'] })
      : [];
    const productById = new Map(products.map((row) => [row.id, row]));
    const variantById = new Map(variants.map((row) => [row.id, row]));
    const freshnessCodes = items.flatMap((row) => {
      const product = productById.get(row.productId);
      const variant = row.variantId ? variantById.get(row.variantId) : undefined;
      return draftItemFreshness({
        draftStatus: draft.status,
        snapshotUnitPriceIrr: row.unitPriceIrr,
        currentUnitPriceIrr: product ? Number(product.retailPrice || 0) : null,
        currentStock: variant ? Number(variant.retailStock || 0) : product ? Number(product.retailStock || 0) : null,
        quantity: row.quantity,
        productActive: !!product && product.status === 'ACTIVE' && product.showOnRetail !== false && (!row.variantId || !!variant),
      });
    });
    const alerts = humanDraftFreshness(freshnessCodes);
    return {
      id: draft.id,
      status: draft.status,
      orderStatus,
      statusLabel: humanPartnerOrderStatus(draft.status, orderStatus, overlay),
      stale: alerts.length > 0,
      alerts,
      customerPhoneMasked: maskCustomerPhone(draft.customerPhone),
      customerName: draft.customerName,
      merchandiseIrr: draft.merchandiseIrr,
      shippingFeeIrr: draft.shippingFeeIrr,
      estimatedCommissionIrr: draft.estimatedCommissionIrr,
      expiresAt: draft.expiresAt,
      convertedOrderId: draft.convertedOrderId,
      sentCount: draft.sentCount,
      lastSentAt: draft.lastSentAt,
      items: items.map((row) => ({
        id: row.id,
        productId: row.productId,
        variantId: row.variantId,
        name: row.productName,
        quantity: row.quantity,
        unitPriceIrr: row.unitPriceIrr,
        lineTotalIrr: row.lineTotalIrr,
        estimatedCommissionIrr: row.estimatedCommissionIrr,
      })),
    };
  }

  private assertCustomerPhone(phoneRaw: string, partnerPhone: string, blockSelf: boolean) {
    const phone = normalizePhone(phoneRaw);
    if (isBlockedSelfReferral(phone, partnerPhone, blockSelf)) {
      throw new BadRequestException('نمی‌توانید برای شماره خودتان سفارش همکار بسازید');
    }
    return phone;
  }

  private phoneHash(phone: string) {
    return createHash('sha256').update(normalizePhone(phone)).digest('hex').slice(0, 64);
  }

  private async ensureRetailCustomer(
    phone: string,
    name: string,
    province: string,
    city: string,
    address: string,
  ) {
    const existing = await this.customers.findByPhone(phone);
    if (existing) {
      if ((existing as { status?: string }).status === 'INACTIVE' || (existing as { isActive?: boolean }).isActive === false) {
        throw new ForbiddenException('این مشتری امکان ثبت سفارش ندارد');
      }
      return existing;
    }
    return this.customers.create({
      businessName: name,
      ownerName: name,
      phone,
      province,
      city,
      address,
      type: 'B2C',
      businessType: 'RETAIL',
      status: 'ACTIVE',
    });
  }
}

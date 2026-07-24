import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { InvoiceEntity } from '../invoice/entities/invoice.entity';
import { CustomerService } from '../customer/customer.service';
import { ProductService } from '../product/product.service';
import { NotificationService } from '../notification/notification.service';
import { SettingsService } from '../settings/settings.service';
import { DiscountService } from '../discount/discount.service';
import { PaymentService } from '../payment/payment.service';
import { ShippingService } from '../shipping/shipping.service';

interface CreateOrderDto {
  customerId: string;
  /** WHOLESALE (default) | RETAIL_WEBSITE — drives price + MOQ rules */
  type?: string;
  channel?: 'WHOLESALE' | 'RETAIL';
  items: Array<{
    productVariantId?: string;
    productId?: string;
    quantity: number;
    unitPrice?: number;
    productName?: string;
    sku?: string;
    color?: string;
    size?: string;
  }>;
  shippingMethod?: string;
  paymentMethod?: string;
  installment?: { downPaymentAmount: number; months: number };
  notes?: string;
  shippingAddress?: string | Record<string, unknown>;
  freeShipping?: boolean;
  intraCityFee?: number;
  perKgFee?: number;
  discountCode?: string;
  /** Apply customer wallet credit toward order total (retail) */
  useWallet?: boolean;
  affiliateId?: string;
}

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepo: Repository<OrderItemEntity>,
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>,
    private readonly customerService: CustomerService,
    private readonly productService: ProductService,
    private readonly settings: SettingsService,
    private readonly discounts: DiscountService,
    private readonly paymentService: PaymentService,
    private readonly shippingService: ShippingService,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  private async customerPurchaseStats(customerId: string) {
    const invoices = await this.invoiceRepo.find({
      where: {
        customerId,
        status: Not(In(['VOIDED', 'CANCELLED', 'DRAFT'])),
      },
    });
    const orders = await this.orderRepo.find({
      where: { customerId, status: Not(In(['CANCELLED'])) },
      relations: ['items'],
    });
    const invoiceCount = invoices.length;
    const invoiceSum = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
    const productCount = orders.reduce(
      (s, o) => s + (o.items ?? []).reduce((ss, it) => ss + Number(it.quantity || 0), 0),
      0,
    );
    return {
      invoiceCount,
      invoiceSum,
      productCount,
      isFirstInvoice: invoiceCount === 0,
    };
  }

  async quoteDiscounts(customerId: string, subtotal: number, discountCode?: string, categoryIds: string[] = []) {
    const stats = await this.customerPurchaseStats(customerId);
    const tiered = await this.discounts.applyTiered(subtotal);
    const side = await this.discounts.applySide(subtotal, { ...stats, categoryIds });
    let code: { id?: string; code?: string; discount: number; percent?: number } | null = null;
    if (discountCode?.trim()) {
      const validated = await this.discounts.validate(discountCode.trim(), subtotal);
      code = { id: validated.id, code: validated.code, discount: validated.discount };
    }
    // Stack: take best of (tiered+side) vs code alone? Spec says tiered is automatic without code,
    // side is extra, code is separate. Apply tiered + side + code (capped at subtotal).
    const discount = Math.min(
      subtotal,
      (tiered.discount || 0) + (side.discount || 0) + (code?.discount || 0),
    );
    return { tiered, side, code, discount, stats };
  }

  private async countActiveInvoices(customerId: string): Promise<number> {
    return this.invoiceRepo.count({
      where: {
        customerId,
        status: Not(In(['VOIDED', 'CANCELLED', 'DRAFT'])),
      },
    });
  }

  async installmentEligibility(customerId: string) {
    const cfg = await this.settings.installments();
    const activeInvoiceCount = await this.countActiveInvoices(customerId);
    const required = cfg.minActiveInvoices ?? 2;
    return {
      eligible: activeInvoiceCount >= required,
      activeInvoiceCount,
      required,
      rules: cfg.rules,
      minDownPaymentPercent: cfg.minDownPaymentPercent,
      maxMonths: cfg.maxMonths,
      message: activeInvoiceCount >= required
        ? null
        : `پرداخت اقساطی فقط برای مشتریانی با حداقل ${required} فاکتور فعال امکان‌پذیر است. شما ${activeInvoiceCount} فاکتور فعال دارید.`,
    };
  }

  // Fire-and-forget SMS — never blocks or fails the order flow.
  private notify(fn: (phone: string) => Promise<unknown>, customerId: string) {
    this.customerService
      .findOne(customerId)
      .then((c: any) => c?.phone && fn(c.phone))
      .catch(() => undefined);
  }

  private async generateOrderNumber(): Promise<string> {
    const count = await this.orderRepo.count();
    const year = new Date().getFullYear();
    return `ORD-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private assertMoq(quantity: number, minOrderQty: number, label: string) {
    const moq = Math.max(1, Number(minOrderQty) || 1);
    if (quantity < moq) {
      throw new BadRequestException(`حداقل سفارش برای ${label} برابر ${moq} عدد است`);
    }
    if (quantity % moq !== 0) {
      throw new BadRequestException(`تعداد سفارش برای ${label} باید مضربی از ${moq} باشد`);
    }
  }

  private resolveOrderChannel(dto: CreateOrderDto): 'WHOLESALE' | 'RETAIL' {
    const raw = (dto.type || dto.channel || 'WHOLESALE').toUpperCase();
    if (raw === 'RETAIL' || raw === 'RETAIL_WEBSITE') return 'RETAIL';
    return 'WHOLESALE';
  }

  private unitPriceForChannel(
    channel: 'WHOLESALE' | 'RETAIL',
    product: { wholesalePrice?: number | string | null; retailPrice?: number | string | null },
    fallback?: number,
  ) {
    if (channel === 'RETAIL') {
      const retail = Number(product.retailPrice ?? 0);
      if (retail > 0) return retail;
      throw new BadRequestException('قیمت خرده‌فروشی برای این محصول تعریف نشده است');
    }
    return Number(product.wholesalePrice ?? fallback ?? 0);
  }

  async create(dto: CreateOrderDto) {
    const customer = await this.customerService.findOne(dto.customerId);

    if (!dto.items?.length) throw new BadRequestException('سفارش باید حداقل یک کالا داشته باشد');
    const channel = this.resolveOrderChannel(dto);
    const orderType = channel === 'RETAIL' ? 'RETAIL_WEBSITE' : (dto.type || 'WHOLESALE');
    const paymentMethod = (dto.paymentMethod ?? (channel === 'RETAIL' ? 'ONLINE' : 'CASH')).toUpperCase();
    const allowedPay =
      channel === 'RETAIL' ? ['CASH', 'ONLINE'] : ['CASH', 'INSTALLMENT', 'ONLINE'];
    if (!allowedPay.includes(paymentMethod)) {
      throw new BadRequestException('روش پرداخت نامعتبر است');
    }

    // Expand items; stock is checked at variant level (then synced to product).
    const expandedItems: Array<{
      productVariantId: string;
      quantity: number;
      unitPrice: number;
      productName: string;
      sku: string;
      color: string;
      size: string;
      productId: string;
    }> = [];

    for (const item of dto.items) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) throw new BadRequestException('تعداد سفارش نامعتبر است');

      if (item.productVariantId) {
        const variant = await this.productService.getVariant(item.productVariantId);
        const product = variant.product;
        if (!product) throw new BadRequestException('محصول واریانت یافت نشد');
        if (channel === 'WHOLESALE') {
          this.assertMoq(qty, product.minOrderQty ?? 1, product.name);
        }
        const variantStock = Number(variant.stock) || 0;
        if (variantStock < qty) {
          throw new BadRequestException(
            `موجودی کافی نیست برای ${product.name} (${variant.color}/${variant.size}) — موجودی: ${variantStock}`,
          );
        }
        expandedItems.push({
          productVariantId: variant.id,
          quantity: qty,
          unitPrice: this.unitPriceForChannel(channel, product, Number(item.unitPrice ?? 0)),
          productName: product.name ?? item.productName ?? '',
          sku: product.sku ?? item.sku ?? '',
          color: variant.color,
          size: variant.size,
          productId: product.id,
        });
        continue;
      }

      if (!item.productId) {
        throw new BadRequestException('شناسه محصول/واریانت ارسال نشده است');
      }

      const product = await this.productService.findOne(item.productId);
      if (channel === 'WHOLESALE') {
        this.assertMoq(qty, product.minOrderQty ?? 1, product.name);
      }

      const variants = product.variants ?? [];
      const metaVariant =
        variants.find((v) => (!item.color || v.color === item.color) && (!item.size || v.size === item.size))
        ?? variants[0];
      if (!metaVariant) {
        throw new BadRequestException(`برای ${product.name} ابتدا حداقل یک رنگ در واریانت‌ها تعریف کنید`);
      }
      const variantStock = Number(metaVariant.stock) || 0;
      if (variantStock < qty) {
        throw new BadRequestException(
          `موجودی کافی نیست برای ${product.name} (${metaVariant.color}/${metaVariant.size}) — موجودی: ${variantStock}`,
        );
      }
      expandedItems.push({
        productVariantId: metaVariant.id,
        quantity: qty,
        unitPrice: this.unitPriceForChannel(channel, product),
        productName: product.name,
        sku: product.sku,
        color: metaVariant.color,
        size: metaVariant.size,
        productId: product.id,
      });
    }

    const subtotal = expandedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const pieces = expandedItems.reduce((s, i) => s + i.quantity, 0);

    const categoryIds = [...new Set(
      (await Promise.all(
        expandedItems.map(async (i) => {
          const v = await this.productService.getVariant(i.productVariantId);
          return (v as any).product?.categoryId as string | undefined;
        }),
      )).filter(Boolean),
    )] as string[];

    let discountAmount = 0;
    let usedDiscountCodeId: string | undefined;
    if (channel === 'WHOLESALE') {
      const quote = await this.quoteDiscounts(dto.customerId, subtotal, dto.discountCode, categoryIds);
      discountAmount = quote.discount;
      usedDiscountCodeId = quote.code?.id;
      const discountNotes: string[] = [];
      if (quote.tiered.discount) discountNotes.push(`TIERED ${quote.tiered.percent}%=${quote.tiered.discount}`);
      if (quote.side.discount) discountNotes.push(`SIDE ${quote.side.type} ${quote.side.percent}%=${quote.side.discount}`);
      if (quote.code?.discount) discountNotes.push(`CODE ${quote.code.code}=${quote.code.discount}`);
      if (discountNotes.length) {
        const tag = `DISCOUNTS ${discountNotes.join(' | ')}`;
        dto.notes = dto.notes ? `${dto.notes}\n${tag}` : tag;
      }
    } else if (dto.discountCode) {
      const quote = await this.quoteDiscounts(dto.customerId, subtotal, dto.discountCode, categoryIds);
      discountAmount = quote.code?.discount ?? 0;
      usedDiscountCodeId = quote.code?.id;
      if (discountAmount > 0 && quote.code) {
        const tag = `DISCOUNTS CODE ${quote.code.code}=${quote.code.discount}`;
        dto.notes = dto.notes ? `${dto.notes}\n${tag}` : tag;
      }
    }

    const shippingMethod = dto.shippingMethod ?? (channel === 'RETAIL' ? 'PISHTAZ' : 'CHAPAR');
    let computedShipping = 0;
    let freeShipping = !!dto.freeShipping;
    const intraCityFee = Number(dto.intraCityFee) || 0;
    const perKgFee = Number(dto.perKgFee) || 0;

    if (channel === 'RETAIL' && !freeShipping) {
      const shipQuote = await this.shippingService.quote({
        pieces,
        orderTotal: Math.max(0, subtotal - discountAmount),
        method: shippingMethod,
      });
      computedShipping = Number(shipQuote.fee) || 0;
      freeShipping = !!shipQuote.freeShipping;
    } else if (!freeShipping) {
      const wholesaleFreeFrom = 50_000_000;
      const wholesaleDefaultShip = 1_500_000;
      computedShipping = intraCityFee || ((subtotal - discountAmount) >= wholesaleFreeFrom ? 0 : wholesaleDefaultShip);
    }

    let orderTotal = Math.max(0, subtotal - discountAmount + computedShipping);
    let walletApplied = 0;
    if (channel === 'RETAIL' && dto.useWallet) {
      const bal = Math.max(0, Number((customer as any).balance) || 0);
      walletApplied = Math.min(bal, orderTotal);
      orderTotal = Math.max(0, orderTotal - walletApplied);
      if (walletApplied > 0) {
        const tag = `WALLET_APPLIED=${walletApplied}`;
        dto.notes = dto.notes ? `${dto.notes}\n${tag}` : tag;
      }
    }

    if (paymentMethod === 'INSTALLMENT') {
      if (channel === 'RETAIL') {
        throw new BadRequestException('پرداخت اقساطی فقط برای سفارش عمده است');
      }
      const activeInvoiceCount = await this.countActiveInvoices(dto.customerId);
      const cfg = await this.settings.installments();
      if (activeInvoiceCount < (cfg.minActiveInvoices ?? 2)) {
        throw new BadRequestException(
          `پرداخت اقساطی فقط برای مشتریانی با حداقل ${cfg.minActiveInvoices ?? 2} فاکتور فعال امکان‌پذیر است`,
        );
      }
      const rules = cfg.rules?.length ? cfg.rules : [{
        id: 'default',
        minDownPaymentPercent: cfg.minDownPaymentPercent,
        maxMonths: cfg.maxMonths,
        categoryId: null as string | null,
      }];
      const matched = rules.find((r: any) => !r.categoryId || categoryIds.includes(r.categoryId))
        ?? rules[0];
      const down = Number(dto.installment?.downPaymentAmount) || 0;
      const months = Number(dto.installment?.months) || 0;
      if (months < 1 || months > matched.maxMonths) {
        throw new BadRequestException(`حداکثر اقساط مجاز: ${matched.maxMonths} ماه`);
      }
      const byPercent = matched.minDownPaymentPercent > 0
        ? Math.ceil((orderTotal * matched.minDownPaymentPercent) / 100)
        : 0;
      const minDown = Math.max(byPercent, cfg.minDownPaymentAmount || 0);
      if (down < minDown) {
        throw new BadRequestException(`حداقل پیش‌پرداخت: ${minDown}`);
      }
      const tag = `INSTALLMENT downPayment=${down} months=${months} rule=${matched.id}`;
      dto.notes = dto.notes ? `${dto.notes}\n${tag}` : tag;
    }

    let shippingAddress: string | undefined;
    if (dto.shippingAddress != null) {
      shippingAddress =
        typeof dto.shippingAddress === 'string'
          ? dto.shippingAddress
          : JSON.stringify(dto.shippingAddress);
    }

    const order = this.orderRepo.create({
      orderNumber: await this.generateOrderNumber(),
      customerId: dto.customerId,
      type: orderType,
      subtotal,
      discount: discountAmount + walletApplied,
      shippingFee: computedShipping,
      total: orderTotal,
      shippingMethod,
      shippingAddress,
      paymentMethod,
      notes: dto.notes,
      status: 'PENDING_REVIEW',
      intraCityFee,
      perKgFee,
      freeShipping,
      affiliateId: dto.affiliateId?.trim() || undefined,
    });

    const saved = await this.orderRepo.save(order);

    const items = expandedItems.map((i) =>
      this.itemRepo.create({
        productVariantId: i.productVariantId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        productName: i.productName,
        sku: i.sku,
        color: i.color,
        size: i.size,
        orderId: saved.id,
        totalPrice: i.unitPrice * i.quantity,
      })
    );
    await this.itemRepo.save(items);

    // Deduct variant stock and sync product aggregate.
    for (const item of expandedItems) {
      await this.productService.updateVariantStock(item.productVariantId, -item.quantity);
    }

    if (walletApplied > 0) {
      await this.customerService.updateBalance(dto.customerId, -walletApplied);
    }

    if (usedDiscountCodeId) {
      await this.discounts.recordUse(usedDiscountCodeId);
    }

    if (this.notifications) {
      this.notify((p) => this.notifications!.orderRegistered(p, saved.orderNumber), dto.customerId);
    }

    const full = await this.findOne(saved.id);

    // Retail ONLINE: start Zarinpal and return paymentUrl for redirect.
    if (channel === 'RETAIL' && paymentMethod === 'ONLINE' && orderTotal > 0) {
      try {
        const pay = await this.paymentService.start({
          amount: orderTotal,
          orderId: saved.id,
          customerId: dto.customerId,
          description: `پرداخت سفارش ${saved.orderNumber}`,
          mobile: (customer as any).phone,
        });
        return { ...full, paymentUrl: pay.redirectUrl, paymentId: pay.paymentId };
      } catch (err) {
        // Order already created — surface error so client can retry payment or switch to COD.
        throw err;
      }
    }

    return full;
  }

  async findAll(page = 1, limit = 20, customerId?: string, status?: string, type?: string) {
    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (type) where.type = type;

    const [data, total] = await this.orderRepo.findAndCount({
      where,
      relations: ['items'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const order = await this.orderRepo.findOne({ where: { id }, relations: ['items', 'customer'] });
    if (!order) throw new NotFoundException('سفارش یافت نشد');
    return order;
  }

  async updateStatus(id: string, status: string, processedBy?: string) {
    const order = await this.findOne(id);
    const prev = order.status;
    order.status = status;
    if (processedBy) order.processedBy = processedBy;
    if (status === 'CONFIRMED') order.confirmedAt = new Date();
    if (status === 'SHIPPED') order.shippedAt = new Date();
    if (status === 'DELIVERED') order.deliveredAt = new Date();
    const saved = await this.orderRepo.save(order);

    // Restore variant stock when cancelling a previously active order.
    if (status === 'CANCELLED' && prev !== 'CANCELLED') {
      for (const item of order.items ?? []) {
        if (item.productVariantId) {
          await this.productService.updateVariantStock(item.productVariantId, Number(item.quantity) || 0);
        }
      }
    }

    if (this.notifications) {
      if (status === 'CONFIRMED') {
        this.notify((p) => this.notifications!.orderConfirmed(p, order.orderNumber), order.customerId);
      } else if (status === 'SHIPPED') {
        this.notify(
          (p) => this.notifications!.orderShipped(p, order.orderNumber, order.trackingCode),
          order.customerId,
        );
      }
    }
    return saved;
  }

  async addTracking(
    id: string,
    trackingCode: string,
    shippingMethod?: string,
    extra?: { freightCost?: number; freightReceiptUrl?: string },
  ) {
    const patch: Partial<OrderEntity> = { trackingCode, status: 'SHIPPED', shippedAt: new Date() };
    if (shippingMethod) patch.shippingMethod = shippingMethod;
    if (extra?.freightCost !== undefined) patch.freightCost = Number(extra.freightCost) || 0;
    if (extra?.freightReceiptUrl !== undefined) patch.freightReceiptUrl = extra.freightReceiptUrl || undefined;
    await this.orderRepo.update(id, patch as any);
    const order = await this.findOne(id);
    if (this.notifications) {
      this.notify(
        (p) => this.notifications!.orderShipped(p, order.orderNumber, trackingCode),
        order.customerId,
      );
    }
    return order;
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
  ForbiddenException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { InvoiceEntity } from '../invoice/entities/invoice.entity';
import { CustomerService } from '../customer/customer.service';
import { ProductService } from '../product/product.service';
import { NotificationService } from '../notification/notification.service';
import { SettingsService } from '../settings/settings.service';
import { DiscountService } from '../discount/discount.service';
import { requireDiscountChannel } from '../discount/discount-channel';
import { PaymentService } from '../payment/payment.service';
import { InstallmentService } from '../payment/installment.service';
import { ShippingService } from '../shipping/shipping.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { resolveChannelSale } from '../product/product-sale';
import { sizesForSizeType } from '../product/product-pack';
import { channelUnitStock } from '../product/channel-product-projection';
import { InventoryService } from '../inventory/inventory.service';
import { OutboxService } from '../omnichannel/services/outbox.service';
import { OUTBOX_EVENT_TYPES } from '../omnichannel/omnichannel.constants';
import {
  shouldCommitStockOnConfirm,
  shouldReverseCommittedStock,
} from './order-stock-settlement';

/** Allowed Order status transitions (admin). */
const ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING_REVIEW: ['CONFIRMED', 'PROCESSING', 'CANCELLED', 'DELETED'],
  CONFIRMED: ['PROCESSING', 'SHIPPED', 'CANCELLED', 'DELETED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'DELETED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: ['DELETED'],
  DELETED: [],
  REFUNDED: [],
};

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
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
    private readonly installmentService: InstallmentService,
    private readonly shippingService: ShippingService,
    private readonly dataSource: DataSource,
    private readonly inventoryService: InventoryService,
    private readonly outbox: OutboxService,
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
      where: { customerId, status: Not(In(['CANCELLED', 'DELETED'])) },
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

  async quoteDiscounts(
    customerId: string,
    subtotal: number,
    discountCode?: string,
    categoryIds: string[] = [],
    channel?: string,
  ) {
    const ch = requireDiscountChannel(channel);
    const stats = await this.customerPurchaseStats(customerId);
    const emptyAuto = { percent: 0, discount: 0 };
    const tiered = ch === 'WHOLESALE' ? await this.discounts.applyTiered(subtotal) : emptyAuto;
    const side = ch === 'WHOLESALE'
      ? await this.discounts.applySide(subtotal, { ...stats, categoryIds })
      : emptyAuto;
    let code: { id?: string; code?: string; discount: number; percent?: number } | null = null;
    if (discountCode?.trim()) {
      const validated = await this.discounts.validate(discountCode.trim(), subtotal, ch);
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
    const year = new Date().getFullYear();
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    const count = await this.orderRepo.count();
    return `ORD-${year}-${String(count + 1).padStart(5, '0')}-${suffix}`;
  }

  private assertMoq(quantity: number, minOrderQty: number, label: string) {
    const moq = Math.max(1, Number(minOrderQty) || 1);
    if (quantity < moq) {
      throw new BadRequestException(`حداقل سفارش برای ${label} برابر ${moq} پک است`);
    }
  }

  private resolveOrderChannel(dto: CreateOrderDto): 'WHOLESALE' | 'RETAIL' {
    const raw = (dto.type || dto.channel || 'WHOLESALE').toUpperCase();
    if (raw === 'RETAIL' || raw === 'RETAIL_WEBSITE') return 'RETAIL';
    return 'WHOLESALE';
  }

  private resolveCreatePaymentMethod(
    dto: CreateOrderDto,
    channel: 'WHOLESALE' | 'RETAIL',
  ): string {
    return (dto.paymentMethod ?? (channel === 'RETAIL' ? 'ONLINE' : 'CASH')).toUpperCase();
  }

  private resolveCreateShippingMethod(
    dto: CreateOrderDto,
    channel: 'WHOLESALE' | 'RETAIL',
  ): string {
    return dto.shippingMethod ?? (channel === 'RETAIL' ? 'PISHTAZ' : 'CHAPAR');
  }

  private createOrderIdempotencyScope(customerId: string, channel: 'WHOLESALE' | 'RETAIL'): string {
    return `${customerId}:${channel}:create-order`;
  }

  /** Stable SHA-256 over fields that define a duplicate create-order intent. */
  private hashCreateOrderPayload(
    dto: CreateOrderDto,
    channel: 'WHOLESALE' | 'RETAIL',
    paymentMethod: string,
  ): string {
    const items = (dto.items ?? [])
      .map((i) => ({
        productVariantId: String(i.productVariantId || ''),
        quantity: Number(i.quantity) || 0,
      }))
      .sort((a, b) => {
        const byId = a.productVariantId.localeCompare(b.productVariantId);
        return byId !== 0 ? byId : a.quantity - b.quantity;
      });
    const installment = dto.installment
      ? {
          downPaymentAmount: Number(dto.installment.downPaymentAmount) || 0,
          months: Number(dto.installment.months) || 0,
        }
      : null;
    const stable = {
      items,
      paymentMethod,
      paymentGateway: dto.paymentGateway === 'DIGIPAY' ? 'DIGIPAY' : 'ZARINPAL',
      shippingMethod: this.resolveCreateShippingMethod(dto, channel),
      useWallet: !!dto.useWallet,
      installment,
    };
    return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
  }

  private assertIdempotentCreateMatch(
    existing: OrderEntity,
    customerId: string,
    scope: string,
    payloadHash: string,
  ): OrderEntity {
    if (existing.customerId !== customerId) {
      throw new ForbiddenException('کلید یکتایی سفارش متعلق به مشتری دیگری است');
    }
    const storedHash = existing.idempotencyPayloadHash;
    const storedScope = existing.idempotencyScope;
    if (storedHash != null && storedHash !== payloadHash) {
      throw new ConflictException('کلید یکتایی با درخواست متفاوت قبلاً استفاده شده است');
    }
    if (storedScope != null && storedScope !== scope) {
      throw new ConflictException('کلید یکتایی با درخواست متفاوت قبلاً استفاده شده است');
    }
    return existing;
  }

  private unitPriceForChannel(
    channel: 'WHOLESALE' | 'RETAIL',
    product: {
      wholesalePrice?: number | string | null;
      retailPrice?: number | string | null;
      wholesaleCompareAtPrice?: number | string | null;
      retailCompareAtPrice?: number | string | null;
      isDiscounted?: boolean | null;
      discountType?: string | null;
      discountPercent?: number | null;
      discountAmount?: number | null;
      discountStartsAt?: Date | string | null;
      discountEndsAt?: Date | string | null;
    },
    fallback?: number,
  ) {
    const sale = resolveChannelSale(
      {
        isDiscounted: product.isDiscounted,
        discountType: product.discountType,
        discountPercent: product.discountPercent,
        discountAmount: product.discountAmount != null ? Number(product.discountAmount) : null,
        discountStartsAt: product.discountStartsAt,
        discountEndsAt: product.discountEndsAt,
        wholesaleIsDiscounted: (product as { wholesaleIsDiscounted?: boolean }).wholesaleIsDiscounted,
        retailIsDiscounted: (product as { retailIsDiscounted?: boolean }).retailIsDiscounted,
        wholesaleDiscountType: (product as { wholesaleDiscountType?: string | null }).wholesaleDiscountType,
        retailDiscountType: (product as { retailDiscountType?: string | null }).retailDiscountType,
        wholesaleDiscountPercent: (product as { wholesaleDiscountPercent?: number | null }).wholesaleDiscountPercent,
        retailDiscountPercent: (product as { retailDiscountPercent?: number | null }).retailDiscountPercent,
        wholesaleDiscountAmount:
          (product as { wholesaleDiscountAmount?: number | string | null }).wholesaleDiscountAmount != null
            ? Number((product as { wholesaleDiscountAmount?: number | string | null }).wholesaleDiscountAmount)
            : null,
        retailDiscountAmount:
          (product as { retailDiscountAmount?: number | string | null }).retailDiscountAmount != null
            ? Number((product as { retailDiscountAmount?: number | string | null }).retailDiscountAmount)
            : null,
        wholesaleDiscountStartsAt: (product as { wholesaleDiscountStartsAt?: Date | string | null }).wholesaleDiscountStartsAt,
        retailDiscountStartsAt: (product as { retailDiscountStartsAt?: Date | string | null }).retailDiscountStartsAt,
        wholesaleDiscountEndsAt: (product as { wholesaleDiscountEndsAt?: Date | string | null }).wholesaleDiscountEndsAt,
        retailDiscountEndsAt: (product as { retailDiscountEndsAt?: Date | string | null }).retailDiscountEndsAt,
        wholesalePrice: Number(product.wholesalePrice ?? 0),
        retailPrice: product.retailPrice != null ? Number(product.retailPrice) : null,
        wholesaleCompareAtPrice:
          product.wholesaleCompareAtPrice != null ? Number(product.wholesaleCompareAtPrice) : null,
        retailCompareAtPrice:
          product.retailCompareAtPrice != null ? Number(product.retailCompareAtPrice) : null,
      },
      channel,
    );
    if (sale.payable > 0) return sale.payable;
    if (channel === 'RETAIL') {
      throw new BadRequestException('قیمت خرده‌فروشی برای این محصول تعریف نشده است');
    }
    return Number(product.wholesalePrice ?? fallback ?? 0);
  }

  private channelVariantStock(
    variant: { wholesaleStock?: number | string | null; retailStock?: number | string | null; stock?: number | string | null },
    channel: 'WHOLESALE' | 'RETAIL',
  ): number {
    return channelUnitStock(variant, channel);
  }

  /**
   * When cart sends productId without a specific variant, allocate qty across
   * matching variants (optional color/size filter) using channel stock totals.
   */
  private allocateAcrossVariants(
    product: {
      id: string;
      name: string;
      sku?: string;
      minOrderQty?: number;
      wholesalePrice?: number | string | null;
      retailPrice?: number | string | null;
      variants?: Array<{
        id: string;
        color: string;
        size: string;
        wholesaleStock?: number | string | null;
        retailStock?: number | string | null;
        stock?: number | string | null;
      }>;
    },
    qty: number,
    channel: 'WHOLESALE' | 'RETAIL',
    opts?: { color?: string; size?: string; unitPrice?: number; productName?: string; sku?: string },
  ): Array<{
    productVariantId: string;
    quantity: number;
    unitPrice: number;
    productName: string;
    sku: string;
    color: string;
    size: string;
    productId: string;
    imageUrl?: string | null;
  }> {
    const variants = product.variants ?? [];
    const matching = variants.filter(
      (v) => (!opts?.color || v.color === opts.color) && (!opts?.size || v.size === opts.size),
    );
    const pool = matching.length > 0 ? matching : variants;
    if (!pool.length) {
      throw new BadRequestException(`برای ${product.name} ابتدا حداقل یک رنگ در واریانت‌ها تعریف کنید`);
    }

    const totalAvailable = pool.reduce((s, v) => s + this.channelVariantStock(v, channel), 0);
    if (totalAvailable < qty) {
      const meta = [opts?.color, opts?.size].filter(Boolean).join('/');
      throw new BadRequestException(
        `موجودی کافی نیست برای ${product.name}${meta ? ` (${meta})` : ''} — موجودی: ${totalAvailable}`,
      );
    }

    const sorted = [...pool]
      .map((v) => ({ v, stock: this.channelVariantStock(v, channel) }))
      .filter((x) => x.stock > 0)
      .sort((a, b) => b.stock - a.stock);

    const unitPrice = this.unitPriceForChannel(channel, product, Number(opts?.unitPrice ?? 0));
    const productName = product.name ?? opts?.productName ?? '';
    const sku = product.sku ?? opts?.sku ?? '';
    const lines: Array<{
      productVariantId: string;
      quantity: number;
      unitPrice: number;
      productName: string;
      sku: string;
      color: string;
      size: string;
      productId: string;
      imageUrl?: string | null;
    }> = [];

    let remaining = qty;
    for (const { v, stock } of sorted) {
      if (remaining <= 0) break;
      const take = Math.min(stock, remaining);
      if (take <= 0) continue;
      lines.push({
        productVariantId: v.id,
        quantity: take,
        unitPrice,
        productName,
        sku,
        color: v.color,
        size: v.size,
        productId: product.id,
        imageUrl: (v as { imageUrl?: string }).imageUrl ?? null,
      });
      remaining -= take;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        `موجودی کافی نیست برای ${product.name} — موجودی: ${totalAvailable}`,
      );
    }
    return lines;
  }

  /**
   * Wholesale invoice expansion:
   * 1 pack = 1 piece of every (selected/all) color × every size
   * ⇒ pack size = colorCount × sizeCount; N packs ⇒ N pieces per cell.
   */
  private expandByPackMatrix(
    product: {
      id: string;
      name: string;
      sku?: string;
      minOrderQty?: number;
      wholesalePrice?: number | string | null;
      retailPrice?: number | string | null;
      allowWholesaleColorSelect?: boolean;
      minWholesaleColors?: number;
      sizeType?: string;
      specs?: { packQty?: string | number } | null;
      variants?: Array<{
        id: string;
        color: string;
        size: string;
        wholesaleStock?: number | string | null;
        retailStock?: number | string | null;
        stock?: number | string | null;
        imageUrl?: string | null;
      }>;
    },
    packSets: number,
    channel: 'WHOLESALE' | 'RETAIL',
    opts?: { selectedColors?: string[]; unitPrice?: number; productName?: string; sku?: string },
  ): Array<{
    productVariantId: string;
    quantity: number;
    unitPrice: number;
    productName: string;
    sku: string;
    color: string;
    size: string;
    productId: string;
    imageUrl?: string | null;
  }> {
    const sets = Math.max(1, Math.floor(Number(packSets) || 0));
    if (sets < 1) throw new BadRequestException('تعداد پک نامعتبر است');

    const moqSets = Math.max(1, Number(product.minOrderQty) || 1);
    if (sets < moqSets) {
      throw new BadRequestException(`حداقل تعداد پک برای ${product.name} برابر ${moqSets} است`);
    }

    const variants = product.variants ?? [];
    if (!variants.length) {
      throw new BadRequestException(`برای ${product.name} ابتدا حداقل یک رنگ در واریانت‌ها تعریف کنید`);
    }

    const allColors = Array.from(
      new Set(variants.map((v) => String(v.color || '').trim()).filter(Boolean)),
    );
    const allSizes = sizesForSizeType(product.sizeType);
    if (!allColors.length || !allSizes.length) {
      throw new BadRequestException(`رنگ/سایز برای ${product.name} ناقص است`);
    }

    let colors = allColors;
    if (product.allowWholesaleColorSelect) {
      const selected = (opts?.selectedColors ?? [])
        .map((c) => String(c || '').trim())
        .filter(Boolean);
      const uniqueSelected = Array.from(new Set(selected));
      const minColors = Math.max(1, Number(product.minWholesaleColors) || 1);
      if (uniqueSelected.length < minColors) {
        throw new BadRequestException(
          `برای ${product.name} حداقل ${minColors} رنگ باید انتخاب شود`,
        );
      }
      const invalid = uniqueSelected.filter((c) => !allColors.includes(c));
      if (invalid.length) {
        throw new BadRequestException(`رنگ نامعتبر برای ${product.name}: ${invalid.join('، ')}`);
      }
      colors = uniqueSelected;
    }

    // Pack formula: colors × sizes — one piece per color×size cell per pack
    const qtyPerCell = sets;
    const unitPrice = this.unitPriceForChannel(channel, product, Number(opts?.unitPrice ?? 0));
    const productName = product.name ?? opts?.productName ?? '';
    const sku = product.sku ?? opts?.sku ?? '';
    const lines: Array<{
      productVariantId: string;
      quantity: number;
      unitPrice: number;
      productName: string;
      sku: string;
      color: string;
      size: string;
      productId: string;
      imageUrl?: string | null;
    }> = [];

    for (const color of colors) {
      for (const size of allSizes) {
        const variant = variants.find(
          (v) => String(v.color || '').trim() === color && String(v.size || '').trim() === size,
        );
        if (!variant) {
          throw new BadRequestException(
            `واریانت ${color}/${size} برای ${product.name} یافت نشد`,
          );
        }
        const stock = this.channelVariantStock(variant, channel);
        if (stock < qtyPerCell) {
          throw new BadRequestException(
            `موجودی کافی نیست برای ${product.name} (${color}/${size}) — نیاز: ${qtyPerCell}، موجودی: ${stock}`,
          );
        }
        lines.push({
          productVariantId: variant.id,
          quantity: qtyPerCell,
          unitPrice,
          productName,
          sku,
          color,
          size,
          productId: product.id,
          imageUrl: variant.imageUrl ?? null,
        });
      }
    }

    if (!lines.length) {
      throw new BadRequestException(`هیچ ردیف سفارشی برای ${product.name} ساخته نشد`);
    }
    return lines;
  }

  async create(dto: CreateOrderDto & { customerId: string }) {
    const customer = await this.customerService.findOne(dto.customerId);
    if ((customer as any).status !== 'ACTIVE' || (customer as any).isActive === false) {
      throw new ForbiddenException(
        (customer as any).status === 'PENDING'
          ? 'حساب شما هنوز تأیید نشده است'
          : 'حساب شما غیرفعال است و امکان ثبت سفارش ندارد',
      );
    }

    if (!dto.items?.length) throw new BadRequestException('سفارش باید حداقل یک کالا داشته باشد');
    const channel = this.resolveOrderChannel(dto);
    const orderType = channel === 'RETAIL' ? 'RETAIL_WEBSITE' : (dto.type || 'WHOLESALE');
    const paymentMethod = this.resolveCreatePaymentMethod(dto, channel);
    const idempotencyScope = this.createOrderIdempotencyScope(dto.customerId, channel);
    const idempotencyPayloadHash = this.hashCreateOrderPayload(dto, channel, paymentMethod);

    if (dto.idempotencyKey) {
      const existing = await this.orderRepo.findOne({
        where: { idempotencyKey: dto.idempotencyKey } as any,
        relations: ['items'],
      });
      if (existing) {
        return this.assertIdempotentCreateMatch(
          existing,
          dto.customerId,
          idempotencyScope,
          idempotencyPayloadHash,
        );
      }
    }

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
      imageUrl?: string | null;
    }> = [];

    for (const item of dto.items) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) throw new BadRequestException('تعداد سفارش نامعتبر است');

      if (item.productVariantId) {
        const variant = await this.productService.getVariant(item.productVariantId);
        const product = variant.product;
        if (!product) throw new BadRequestException('محصول واریانت یافت نشد');
        const variantStock = this.channelVariantStock(variant, channel);
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
          imageUrl: variant.imageUrl || item.imageUrl || null,
        });
        continue;
      }

      if (!item.productId) {
        throw new BadRequestException('شناسه محصول/واریانت ارسال نشده است');
      }

      const product = await this.productService.findOne(item.productId);
      const hasVariantMatrix = (product.variants ?? []).some(
        (v) => String(v.color || '').trim() && String(v.size || '').trim(),
      );
      const usePackMatrix =
        channel === 'WHOLESALE' &&
        !item.productVariantId &&
        (item.packMode === true || hasVariantMatrix);

      if (usePackMatrix) {
        const allocated = this.expandByPackMatrix(product, qty, channel, {
          selectedColors: item.selectedColors,
          unitPrice: item.unitPrice,
          productName: item.productName,
          sku: item.sku,
        });
        expandedItems.push(
          ...allocated.map((line) => ({
            ...line,
            imageUrl: line.imageUrl || item.imageUrl || null,
          })),
        );
        continue;
      }

      if (channel === 'WHOLESALE') {
        this.assertMoq(qty, product.minOrderQty ?? 1, product.name);
      }

      const allocated = this.allocateAcrossVariants(product, qty, channel, {
        color: item.color,
        size: item.size,
        unitPrice: item.unitPrice,
        productName: item.productName,
        sku: item.sku,
      });
      expandedItems.push(
        ...allocated.map((line) => ({
          ...line,
          imageUrl: line.imageUrl || item.imageUrl || null,
        })),
      );
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
    let notes = dto.notes;
    if (channel === 'WHOLESALE') {
      const quote = await this.quoteDiscounts(dto.customerId, subtotal, dto.discountCode, categoryIds, channel);
      discountAmount = quote.discount;
      usedDiscountCodeId = quote.code?.id;
      const discountNotes: string[] = [];
      if (quote.tiered.discount) discountNotes.push(`TIERED ${quote.tiered.percent}%=${quote.tiered.discount}`);
      if (quote.side.discount) discountNotes.push(`SIDE ${quote.side.type} ${quote.side.percent}%=${quote.side.discount}`);
      if (quote.code?.discount) discountNotes.push(`CODE ${quote.code.code}=${quote.code.discount}`);
      if (discountNotes.length) {
        const tag = `DISCOUNTS ${discountNotes.join(' | ')}`;
        notes = notes ? `${notes}\n${tag}` : tag;
      }
    } else if (dto.discountCode) {
      const quote = await this.quoteDiscounts(dto.customerId, subtotal, dto.discountCode, categoryIds, channel);
      discountAmount = quote.code?.discount ?? 0;
      usedDiscountCodeId = quote.code?.id;
      if (discountAmount > 0 && quote.code) {
        const tag = `DISCOUNTS CODE ${quote.code.code}=${quote.code.discount}`;
        notes = notes ? `${notes}\n${tag}` : tag;
      }
    }

    // Shipping is ALWAYS computed server-side — ignore client freeShipping / fees.
    const shippingMethod = this.resolveCreateShippingMethod(dto, channel);
    let computedShipping = 0;
    let freeShipping = false;
    let intraCityFee = 0;
    let perKgFee = 0;

    if (channel === 'RETAIL') {
      const shipQuote = await this.shippingService.quote({
        pieces,
        orderTotal: Math.max(0, subtotal - discountAmount),
        method: shippingMethod,
      });
      computedShipping = Number(shipQuote.fee) || 0;
      freeShipping = !!shipQuote.freeShipping;
    } else {
      const shipCfg = await this.settings.shipping();
      const wholesaleCfg = shipCfg.wholesale ?? shipCfg;
      const wholesaleFreeFrom = Number(wholesaleCfg.freeThreshold) || 50_000_000;
      const wholesaleDefaultShip = Number(wholesaleCfg.baseFee) || 1_500_000;
      computedShipping =
        (subtotal - discountAmount) >= wholesaleFreeFrom ? 0 : wholesaleDefaultShip;
      freeShipping = computedShipping === 0;
      intraCityFee = computedShipping;
    }

    let orderTotal = Math.max(0, subtotal - discountAmount + computedShipping);
    let walletApplied = 0;
    if (channel === 'RETAIL' && dto.useWallet) {
      const bal = Math.max(0, Number((customer as any).balance) || 0);
      walletApplied = Math.min(bal, orderTotal);
      orderTotal = Math.max(0, orderTotal - walletApplied);
      if (walletApplied > 0) {
        const tag = `WALLET_APPLIED=${walletApplied}`;
        notes = notes ? `${notes}\n${tag}` : tag;
      }
    }

    let installmentDown = 0;
    let installmentMonths = 0;
    let installmentRuleId: string | null = null;
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
      installmentDown = down;
      installmentMonths = months;
      installmentRuleId = matched.id ? String(matched.id) : null;
      const tag = `INSTALLMENT downPayment=${down} months=${months} rule=${matched.id}`;
      notes = notes ? `${notes}\n${tag}` : tag;
    }

    let shippingAddress: string | undefined;
    if (dto.shippingAddress != null) {
      shippingAddress =
        typeof dto.shippingAddress === 'string'
          ? dto.shippingAddress
          : JSON.stringify(dto.shippingAddress);
    }

    // Persist the order and all financial/inventory effects on one DB connection.
    // Any failed conditional update rolls the entire checkout back.
    let saved: OrderEntity;
    try {
      saved = await this.dataSource.transaction(async (manager) => {
        const orderRepo = manager.getRepository(OrderEntity);
        const itemRepo = manager.getRepository(OrderItemEntity);

        let orderRow: OrderEntity | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const orderNumber = await this.generateOrderNumber();
          try {
            orderRow = (await orderRepo.save(
              orderRepo.create({
                orderNumber,
                customerId: dto.customerId,
                type: orderType,
                subtotal,
                discount: discountAmount + walletApplied,
                shippingFee: computedShipping,
                total: orderTotal,
                shippingMethod,
                shippingAddress,
                paymentMethod,
                notes,
                status: 'PENDING_REVIEW',
                intraCityFee,
                perKgFee,
                freeShipping,
                affiliateId: dto.affiliateId?.trim() || undefined,
                torobClid:
                  dto.torobClid?.trim() ||
                  (dto.affiliateId?.trim()?.startsWith('torob|')
                    ? dto.affiliateId.trim().slice('torob|'.length)
                    : undefined),
                walletApplied,
                discountCodeId: usedDiscountCodeId,
                idempotencyKey: dto.idempotencyKey || undefined,
                idempotencyPayloadHash: dto.idempotencyKey ? idempotencyPayloadHash : undefined,
                idempotencyScope: dto.idempotencyKey ? idempotencyScope : undefined,
              }),
            )) as OrderEntity;
            break;
          } catch (err: any) {
            if (err?.code === '23505' && attempt < 4) continue;
            throw err;
          }
        }
        if (!orderRow) throw new BadRequestException('امکان ایجاد شماره سفارش نبود');

        const items = expandedItems.map((i) =>
          itemRepo.create({
            productVariantId: i.productVariantId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            productName: i.productName,
            sku: i.sku,
            color: i.color,
            size: i.size,
            imageUrl: i.imageUrl || null,
            orderId: orderRow!.id,
            totalPrice: i.unitPrice * i.quantity,
          }),
        );
        await itemRepo.save(items);

        // Stock stays until settlement (CONFIRMED / paid). Availability was checked above.
        if (walletApplied > 0) {
          await this.customerService.updateBalance(dto.customerId, -walletApplied, manager);
        }
        if (usedDiscountCodeId) {
          await this.discounts.recordUse(usedDiscountCodeId, manager);
        }

        if (paymentMethod === 'INSTALLMENT') {
          await this.installmentService.createFromOrder(
            {
              orderId: orderRow.id,
              customerId: dto.customerId,
              principalIrr: orderTotal,
              downPaymentIrr: installmentDown,
              termCount: installmentMonths,
              ruleId: installmentRuleId,
              actorId: 'system:checkout',
            },
            manager,
          );
        }

        await this.outbox.enqueue(
          {
            operationId: `${orderRow.id}:created`,
            eventType: OUTBOX_EVENT_TYPES.ORDER_CREATED_NOTIFICATION,
            aggregateType: 'ORDER',
            aggregateId: orderRow.id,
            channel,
            payload: { orderId: orderRow.id, orderNumber: orderRow.orderNumber, customerId: dto.customerId },
          },
          manager,
        );

        if (channel === 'RETAIL' && dto.affiliateId) {
          const affiliateStatus =
            paymentMethod === 'CASH' ? 'pending' : paymentMethod === 'ONLINE' && orderTotal === 0 ? 'paid' : null;
          if (affiliateStatus) {
            await this.outbox.enqueue(
              {
                operationId: `${orderRow.id}:affiliate:${affiliateStatus}`,
                eventType: OUTBOX_EVENT_TYPES.AFFILIATE_POSTBACK_REQUESTED,
                aggregateType: 'ORDER',
                aggregateId: orderRow.id,
                channel,
                payload: { orderId: orderRow.id, status: affiliateStatus },
              },
              manager,
            );
          }
        }

        return orderRow;
      });
    } catch (err: any) {
      // Concurrent create with the same idempotency key: return the winner after ownership/hash checks.
      if (err?.code === '23505' && dto.idempotencyKey) {
        const existing = await this.orderRepo.findOne({
          where: { idempotencyKey: dto.idempotencyKey } as any,
          relations: ['items'],
        });
        if (existing) {
          return this.assertIdempotentCreateMatch(
            existing,
            dto.customerId,
            idempotencyScope,
            idempotencyPayloadHash,
          );
        }
      }
      throw err;
    }

    const full = await this.findOne(saved.id);

    if (channel === 'RETAIL' && paymentMethod === 'ONLINE' && orderTotal > 0) {
      try {
        const pay = await this.paymentService.start({
          amount: orderTotal,
          orderId: saved.id,
          customerId: dto.customerId,
          description: `پرداخت سفارش ${saved.orderNumber}`,
          mobile: (customer as any).phone,
          channel: 'RETAIL',
          providerCode: dto.paymentGateway === 'DIGIPAY' ? 'DIGIPAY' : 'ZARINPAL',
        });
        return { ...full, paymentUrl: pay.redirectUrl, paymentId: pay.paymentId };
      } catch (err: any) {
        // Order is already committed and remains payable; surface start failure without rolling back.
        const paymentStartError =
          (typeof err?.message === 'string' && err.message) ||
          (typeof err?.response?.message === 'string' && err.response.message) ||
          'payment_start_failed';
        return { ...full, paymentStartError };
      }
    }

    // Affiliate pending/paid intents are in the checkout outbox. Zero-total ONLINE still confirms here.
    if (channel === 'RETAIL' && dto.affiliateId && paymentMethod === 'ONLINE' && orderTotal === 0) {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(OrderEntity).update(saved.id, {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        } as any);
        await this.outbox.enqueue(
          {
            operationId: `${saved.id}:status:CONFIRMED`,
            eventType: OUTBOX_EVENT_TYPES.ORDER_STATUS_CHANGED_NOTIFICATION,
            aggregateType: 'ORDER',
            aggregateId: saved.id,
            channel,
            payload: { orderId: saved.id, status: 'CONFIRMED' },
          },
          manager,
        );
        await this.commitStockForOrder(saved.id, manager);
      });
      return this.findOne(saved.id);
    }

    return full;
  }

  async findAll(
    page = 1,
    limit = 20,
    customerId?: string,
    status?: string,
    type?: string,
    opts?: { includeDeleted?: boolean; channel?: string },
  ) {
    const where: any = {};
    if (customerId) where.customerId = customerId;
    let resolvedType = type;
    if (!resolvedType && opts?.channel) {
      const ch = String(opts.channel).toUpperCase();
      resolvedType = ch === 'RETAIL' ? 'RETAIL_WEBSITE' : 'WHOLESALE';
    }
    if (resolvedType) where.type = resolvedType;

    if (status) {
      where.status = status;
      // Customers must not fetch DELETED even with explicit filter
      if (status === 'DELETED' && !opts?.includeDeleted) {
        return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
      }
    } else if (!opts?.includeDeleted) {
      where.status = Not(In(['DELETED']));
    }

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

  /** Parse wallet from column or legacy notes tag */
  private resolveWalletApplied(order: OrderEntity): number {
    const col = Number(order.walletApplied) || 0;
    if (col > 0) return col;
    const m = String(order.notes || '').match(/WALLET_APPLIED=(\d+)/);
    return m ? Number(m[1]) || 0 : 0;
  }

  private resolveDiscountCodeId(order: OrderEntity): string | undefined {
    if (order.discountCodeId) return order.discountCodeId;
    return undefined;
  }

  private orderStockChannel(order: { type?: string }): 'WHOLESALE' | 'RETAIL' {
    const t = String(order.type || 'WHOLESALE').toUpperCase();
    return t === 'RETAIL' || t === 'RETAIL_WEBSITE' ? 'RETAIL' : 'WHOLESALE';
  }

  /**
   * Deduct channel stock once, when the order is financially settled / confirmed.
   * Idempotent via stockCommittedAt. Safe to call from payment verify in the same txn.
   */
  async commitStockForOrder(orderId: string, manager?: EntityManager): Promise<void> {
    const run = async (txn: EntityManager) => {
      const orderRepo = txn.getRepository(OrderEntity);
      const locked = await orderRepo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
        relations: ['items'],
      });
      if (!locked || locked.stockCommittedAt || locked.effectsReversedAt) return;
      const channel = this.orderStockChannel(locked);
      for (const item of locked.items ?? []) {
        if (!item.productVariantId) continue;
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) continue;
        const updated = await this.productService.updateVariantStock(
          item.productVariantId,
          -qty,
          channel,
          txn,
        );
        await this.inventoryService.recordMovement(
          {
            productVariantId: item.productVariantId,
            productId: updated.productId,
            type: 'SALE',
            quantity: qty,
            balanceAfter: channelUnitStock(updated, channel),
            referenceId: locked.id,
            referenceType: 'ORDER',
            channel,
            notes: `فروش سفارش ${locked.orderNumber}`,
          },
          txn,
        );
        await this.outbox.enqueue(
          {
            operationId: `${locked.id}:stock:${item.productVariantId}`,
            eventType: OUTBOX_EVENT_TYPES.PRODUCT_STOCK_CHANGED,
            aggregateType: 'PRODUCT',
            aggregateId: updated.productId,
            channel,
            payload: {
              productId: updated.productId,
              productVariantId: item.productVariantId,
              orderId: locked.id,
              channel,
            },
          },
          txn,
        );
        await this.outbox.enqueue(
          {
            operationId: `${locked.id}:search:${updated.productId}`,
            eventType: OUTBOX_EVENT_TYPES.SEARCH_REINDEX_REQUESTED,
            aggregateType: 'PRODUCT',
            aggregateId: updated.productId,
            payload: { productId: updated.productId },
          },
          txn,
        );
      }
      await orderRepo.update(locked.id, { stockCommittedAt: new Date() });
    };
    if (manager) {
      await run(manager);
      return;
    }
    await this.dataSource.transaction((txn) => run(txn));
  }

  /**
   * Reverse all side-effects of an order (stock, wallet, discount use, pending payments, affiliate).
   * Idempotent via effectsReversedAt.
   * Uses UPDATE (not save) so TypeORM does not null customerId when the customer relation is missing/soft-deleted.
   */
  private async reverseEffects(order: OrderEntity) {
    if (order.effectsReversedAt) return order;

    const full = await this.findOne(order.id);
    const channel = this.orderStockChannel(full);

    await this.dataSource.transaction(async (manager) => {
      if (shouldReverseCommittedStock(full)) {
      for (const item of full.items ?? []) {
        if (!item.productVariantId) continue;
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) continue;
        const updated = await this.productService.updateVariantStock(
          item.productVariantId,
          qty,
          channel,
          manager,
        );
        await this.inventoryService.recordMovement(
          {
            productVariantId: item.productVariantId,
            productId: updated.productId,
            type: 'RETURN',
            quantity: qty,
            balanceAfter: channelUnitStock(updated, channel),
            referenceId: full.id,
            referenceType: 'ORDER',
            channel,
            notes: `برگشت سفارش ${full.orderNumber}`,
          },
          manager,
        );
        await this.outbox.enqueue(
          {
            operationId: `${full.id}:return:${item.productVariantId}`,
            eventType: OUTBOX_EVENT_TYPES.PRODUCT_STOCK_CHANGED,
            aggregateType: 'PRODUCT',
            aggregateId: updated.productId,
            channel,
            payload: {
              productId: updated.productId,
              productVariantId: item.productVariantId,
              orderId: full.id,
              channel,
            },
          },
          manager,
        );
      }
      }
      if (full.affiliateId) {
        await this.outbox.enqueue(
          {
            operationId: `${full.id}:affiliate:cancelled`,
            eventType: OUTBOX_EVENT_TYPES.AFFILIATE_POSTBACK_REQUESTED,
            aggregateType: 'ORDER',
            aggregateId: full.id,
            channel,
            payload: { orderId: full.id, status: 'cancelled' },
          },
          manager,
        );
      }
    });

    const wallet = this.resolveWalletApplied(full);
    if (wallet > 0 && full.customerId) {
      await this.customerService.updateBalance(full.customerId, wallet);
    }

    const codeId = this.resolveDiscountCodeId(full);
    if (codeId) {
      await this.discounts.decrementUse(codeId);
    }

    await this.paymentService.cancelPendingForOrder(full.id);

    if (String(full.paymentMethod || '').toUpperCase() === 'INSTALLMENT') {
      await this.installmentService.cancelByOrderId(
        full.id,
        'system:order-reverse',
        'order_cancelled_or_voided',
      );
    }

    const at = new Date();
    await this.orderRepo.update(full.id, { effectsReversedAt: at });
    full.effectsReversedAt = at;
    return full;
  }

  async updateStatus(id: string, status: string, processedBy?: string) {
    const order = await this.findOne(id);
    if (order.status === 'DELETED' || order.voidedAt) {
      throw new BadRequestException('سفارش حذف‌شده قابل تغییر وضعیت نیست');
    }
    const prev = order.status;
    const allowed = ORDER_TRANSITIONS[prev];
    if (allowed && prev !== status && !allowed.includes(status)) {
      throw new BadRequestException(`انتقال وضعیت از ${prev} به ${status} مجاز نیست`);
    }
    const patch: Partial<OrderEntity> = { status };
    if (processedBy) patch.processedBy = processedBy;
    if (status === 'CONFIRMED') patch.confirmedAt = new Date();
    if (status === 'SHIPPED') patch.shippedAt = new Date();
    if (status === 'DELIVERED') patch.deliveredAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(OrderEntity).update(id, patch);
      if (shouldCommitStockOnConfirm(prev, status)) {
        await this.commitStockForOrder(id, manager);
      }
      await this.outbox.enqueue(
        {
          operationId: `${id}:status:${status}`,
          eventType: OUTBOX_EVENT_TYPES.ORDER_STATUS_CHANGED_NOTIFICATION,
          aggregateType: 'ORDER',
          aggregateId: id,
          channel: this.orderStockChannel(order),
          payload: { orderId: id, status, previousStatus: prev },
        },
        manager,
      );
    });

    // Full reversal when cancelling (stock + wallet + discount + pending pay)
    if (status === 'CANCELLED' && prev !== 'CANCELLED' && prev !== 'DELETED') {
      await this.reverseEffects(order);
    }

    return this.findOne(id);
  }

  /**
   * Soft-void: keep row in admin list/details with status DELETED,
   * reverse all side-effects, hide from customer flows.
   */
  async voidOrder(id: string, reason?: string, processedBy?: string) {
    const order = await this.findOne(id);
    if (order.status === 'DELETED' || order.voidedAt) {
      return order; // already voided — still viewable
    }
    await this.reverseEffects(order);
    const patch: Partial<OrderEntity> = {
      status: 'DELETED',
      voidedAt: new Date(),
      voidReason: reason?.trim() || 'حذف توسط ادمین',
    };
    if (processedBy) patch.processedBy = processedBy;
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(OrderEntity).update(id, patch);
      await this.outbox.enqueue(
        {
          operationId: `${id}:status:DELETED`,
          eventType: OUTBOX_EVENT_TYPES.ORDER_STATUS_CHANGED_NOTIFICATION,
          aggregateType: 'ORDER',
          aggregateId: id,
          channel: this.orderStockChannel(order),
          payload: { orderId: id, status: 'DELETED' },
        },
        manager,
      );
    });
    return this.findOne(id);
  }

  /**
   * Admin edit: notes/address/shipping/payment + item qty (stock delta) while active.
   */
  async updateOrder(
    id: string,
    dto: {
      notes?: string;
      shippingAddress?: string | Record<string, unknown>;
      shippingMethod?: string;
      paymentMethod?: string;
      items?: Array<{ id: string; quantity: number }>;
    },
  ) {
    const order = await this.findOne(id);
    if (order.status === 'DELETED' || order.voidedAt) {
      throw new BadRequestException('سفارش حذف‌شده قابل ویرایش نیست');
    }

    const locked = ['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status);
    if (locked && dto.items?.length) {
      throw new BadRequestException('اقلام سفارش ارسال‌شده قابل ویرایش نیست');
    }

    if (dto.notes !== undefined) order.notes = dto.notes;
    if (dto.shippingMethod !== undefined) order.shippingMethod = dto.shippingMethod;
    if (dto.paymentMethod !== undefined) order.paymentMethod = dto.paymentMethod;
    if (dto.shippingAddress !== undefined) {
      order.shippingAddress =
        typeof dto.shippingAddress === 'string'
          ? dto.shippingAddress
          : JSON.stringify(dto.shippingAddress);
    }

    if (dto.items?.length && !order.effectsReversedAt) {
      const channel = this.orderStockChannel(order);
      let subtotal = 0;
      await this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(OrderItemEntity);
      for (const patch of dto.items!) {
        const item = (order.items ?? []).find((i) => i.id === patch.id);
        if (!item) continue;
        const nextQty = Math.max(0, Math.floor(Number(patch.quantity) || 0));
        const prevQty = Number(item.quantity) || 0;
        const delta = nextQty - prevQty;
        if (delta !== 0 && item.productVariantId && order.stockCommittedAt) {
          // Same convention as create: negative delta reduces warehouse stock
          const updated = await this.productService.updateVariantStock(
            item.productVariantId,
            -delta,
            channel,
            manager,
          );
          await this.inventoryService.recordMovement({
            productVariantId: item.productVariantId,
            productId: updated.productId,
            type: delta > 0 ? 'SALE' : 'RETURN',
            quantity: Math.abs(delta),
            balanceAfter: channelUnitStock(updated, channel),
            referenceId: order.id,
            referenceType: 'ORDER',
            channel,
            notes: `ویرایش تعداد سفارش ${order.orderNumber}`,
          }, manager);
          await this.outbox.enqueue(
            {
              operationId: `${order.id}:edit:${item.productVariantId}:${prevQty}:${nextQty}`,
              eventType: OUTBOX_EVENT_TYPES.PRODUCT_STOCK_CHANGED,
              aggregateType: 'PRODUCT',
              aggregateId: updated.productId,
              channel,
              payload: {
                productId: updated.productId,
                productVariantId: item.productVariantId,
                orderId: order.id,
                channel,
              },
            },
            manager,
          );
          await this.outbox.enqueue(
            {
              operationId: `${order.id}:edit:${item.productVariantId}:${prevQty}:${nextQty}:search`,
              eventType: OUTBOX_EVENT_TYPES.SEARCH_REINDEX_REQUESTED,
              aggregateType: 'PRODUCT',
              aggregateId: updated.productId,
              payload: { productId: updated.productId },
            },
            manager,
          );
        }
        item.quantity = nextQty;
        item.totalPrice = Number(item.unitPrice) * nextQty;
        await itemRepo.save(item);
      }
      const remaining = (order.items ?? []).filter((i) => (Number(i.quantity) || 0) > 0);
      for (const i of order.items ?? []) {
        if ((Number(i.quantity) || 0) <= 0) await itemRepo.remove(i);
      }
      for (const i of remaining) subtotal += Number(i.unitPrice) * Number(i.quantity);
      const wallet = this.resolveWalletApplied(order);
      const promoDiscount = Math.max(0, (Number(order.discount) || 0) - wallet);
      order.subtotal = subtotal;
      order.discount = promoDiscount + wallet;
      order.total = Math.max(0, subtotal - promoDiscount + (Number(order.shippingFee) || 0) - wallet);
      order.items = remaining;
      await manager.getRepository(OrderEntity).save(order);
      });
    }

    await this.orderRepo.save(order);
    return this.findOne(id);
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
    const order = await this.findOne(id);
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(OrderEntity).update(id, patch as any);
      await this.outbox.enqueue(
        {
          operationId: `${id}:status:SHIPPED`,
          eventType: OUTBOX_EVENT_TYPES.ORDER_STATUS_CHANGED_NOTIFICATION,
          aggregateType: 'ORDER',
          aggregateId: id,
          channel: this.orderStockChannel(order),
          payload: { orderId: id, status: 'SHIPPED' },
        },
        manager,
      );
    });
    return this.findOne(id);
  }
}

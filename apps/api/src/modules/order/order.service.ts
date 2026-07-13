import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { CustomerService } from '../customer/customer.service';
import { ProductService } from '../product/product.service';
import { NotificationService } from '../notification/notification.service';
import { SettingsService } from '../settings/settings.service';

interface CreateOrderDto {
  customerId: string;
  items: Array<{
    // Legacy (variant-based) ordering
    productVariantId?: string;
    // New (product-based) ordering — server will allocate across variants
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
}

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepo: Repository<OrderItemEntity>,
    private readonly customerService: CustomerService,
    private readonly productService: ProductService,
    private readonly settings: SettingsService,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

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

  async create(dto: CreateOrderDto) {
    await this.customerService.findOne(dto.customerId);

    if (!dto.items?.length) throw new BadRequestException('سفارش باید حداقل یک کالا داشته باشد');
    const paymentMethod = (dto.paymentMethod ?? 'CASH').toUpperCase();
    if (!['CASH', 'INSTALLMENT'].includes(paymentMethod)) {
      throw new BadRequestException('روش پرداخت نامعتبر است');
    }

    // Normalize/expand items:
    // - If productVariantId provided: keep single item, but enforce MOQ from its product.
    // - If productId provided: allocate across variants (by stock) and create multiple order items.
    const expandedItems: Array<{
      productVariantId: string;
      quantity: number;
      unitPrice: number;
      productName: string;
      sku: string;
      color: string;
      size: string;
    }> = [];

    for (const item of dto.items) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) throw new BadRequestException('تعداد سفارش نامعتبر است');

      if (item.productVariantId) {
        const variant = await this.productService.getVariant(item.productVariantId);
        this.assertMoq(qty, variant.product?.minOrderQty ?? 1, variant.product?.name ?? 'محصول');
        if (variant.stock < qty) {
          throw new BadRequestException(`موجودی کافی نیست برای ${variant.product?.name ?? 'محصول'} (${variant.color} / ${variant.size})`);
        }
        expandedItems.push({
          productVariantId: variant.id,
          quantity: qty,
          unitPrice: Number(variant.product?.wholesalePrice ?? item.unitPrice ?? 0),
          productName: variant.product?.name ?? item.productName ?? '',
          sku: variant.product?.sku ?? item.sku ?? '',
          color: variant.color,
          size: variant.size,
        });
        continue;
      }

      if (!item.productId) {
        throw new BadRequestException('شناسه محصول/واریانت ارسال نشده است');
      }

      const product = await this.productService.findOne(item.productId);
      this.assertMoq(qty, product.minOrderQty ?? 1, product.name);
      const variants = (product.variants ?? []).map((v) => ({ ...v, stock: Number(v.stock) || 0 }));
      const totalStock = variants.reduce((s, v) => s + v.stock, 0);
      if (totalStock < qty) {
        throw new BadRequestException(`موجودی کافی نیست برای ${product.name} (موجودی کل: ${totalStock})`);
      }

      // Allocate from most-stocked variants first.
      const sorted = [...variants].sort((a, b) => b.stock - a.stock);
      let remaining = qty;
      for (const v of sorted) {
        if (remaining <= 0) break;
        if (v.stock <= 0) continue;
        const take = Math.min(v.stock, remaining);
        if (take <= 0) continue;
        expandedItems.push({
          productVariantId: v.id,
          quantity: take,
          unitPrice: Number(product.wholesalePrice),
          productName: product.name,
          sku: product.sku,
          color: v.color,
          size: v.size,
        });
        remaining -= take;
      }
    }

    // Stock check is already done above. Now compute subtotal on expanded items.
    const subtotal = expandedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const shippingFee = subtotal >= 50_000_000 ? 0 : 1_500_000;
    const total = subtotal + shippingFee;

    if (paymentMethod === 'INSTALLMENT') {
      const cfg = await this.settings.installments();
      const down = Number(dto.installment?.downPaymentAmount) || 0;
      const months = Number(dto.installment?.months) || 0;
      if (months < 1 || months > cfg.maxMonths) {
        throw new BadRequestException(`حداکثر اقساط مجاز: ${cfg.maxMonths} ماه`);
      }
      const byPercent = cfg.minDownPaymentPercent > 0
        ? Math.ceil((total * cfg.minDownPaymentPercent) / 100)
        : 0;
      const minDown = Math.max(byPercent, cfg.minDownPaymentAmount || 0);
      if (down < minDown) {
        throw new BadRequestException(`حداقل پیش‌پرداخت: ${minDown}`);
      }
      // Persist in notes (non-breaking; can be normalized later).
      const tag = `INSTALLMENT downPayment=${down} months=${months}`;
      dto.notes = dto.notes ? `${dto.notes}\n${tag}` : tag;
    }

    const order = this.orderRepo.create({
      orderNumber: await this.generateOrderNumber(),
      customerId: dto.customerId,
      subtotal,
      shippingFee,
      total,
      shippingMethod: dto.shippingMethod ?? 'CHAPAR',
      paymentMethod,
      notes: dto.notes,
      status: 'PENDING_REVIEW',
    });

    const saved = await this.orderRepo.save(order);

    const items = expandedItems.map((i) =>
      this.itemRepo.create({ ...i, orderId: saved.id, totalPrice: i.unitPrice * i.quantity })
    );
    await this.itemRepo.save(items);

    for (const item of expandedItems) {
      await this.productService.updateVariantStock(item.productVariantId, -item.quantity);
    }

    if (this.notifications) {
      this.notify((p) => this.notifications!.orderRegistered(p, saved.orderNumber), dto.customerId);
    }

    return this.findOne(saved.id);
  }

  async findAll(page = 1, limit = 20, customerId?: string, status?: string) {
    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

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
    order.status = status;
    if (processedBy) order.processedBy = processedBy;
    if (status === 'CONFIRMED') order.confirmedAt = new Date();
    if (status === 'SHIPPED') order.shippedAt = new Date();
    if (status === 'DELIVERED') order.deliveredAt = new Date();
    const saved = await this.orderRepo.save(order);

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

  async addTracking(id: string, trackingCode: string, shippingMethod?: string) {
    const patch: Partial<OrderEntity> = { trackingCode, status: 'SHIPPED', shippedAt: new Date() };
    if (shippingMethod) patch.shippingMethod = shippingMethod;
    await this.orderRepo.update(id, patch);
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

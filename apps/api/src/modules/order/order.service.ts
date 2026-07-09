import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { CustomerService } from '../customer/customer.service';
import { ProductService } from '../product/product.service';
import { NotificationService } from '../notification/notification.service';

interface CreateOrderDto {
  customerId: string;
  items: Array<{ productVariantId: string; quantity: number; unitPrice: number; productName: string; sku: string; color: string; size: string }>;
  shippingMethod?: string;
  paymentMethod?: string;
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

  async create(dto: CreateOrderDto) {
    await this.customerService.findOne(dto.customerId);

    if (!dto.items?.length) throw new BadRequestException('سفارش باید حداقل یک کالا داشته باشد');

    for (const item of dto.items) {
      const variant = await this.productService.getVariant(item.productVariantId);
      if (variant.stock < item.quantity) {
        throw new BadRequestException(`موجودی کافی نیست برای ${item.productName} (${item.color} / ${item.size})`);
      }
    }

    const subtotal = dto.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const shippingFee = subtotal >= 50_000_000 ? 0 : 1_500_000;
    const total = subtotal + shippingFee;

    const order = this.orderRepo.create({
      orderNumber: await this.generateOrderNumber(),
      customerId: dto.customerId,
      subtotal,
      shippingFee,
      total,
      shippingMethod: dto.shippingMethod ?? 'CHAPAR',
      paymentMethod: dto.paymentMethod ?? 'CREDIT',
      notes: dto.notes,
      status: 'PENDING_REVIEW',
    });

    const saved = await this.orderRepo.save(order);

    const items = dto.items.map((i) =>
      this.itemRepo.create({ ...i, orderId: saved.id, totalPrice: i.unitPrice * i.quantity })
    );
    await this.itemRepo.save(items);

    for (const item of dto.items) {
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

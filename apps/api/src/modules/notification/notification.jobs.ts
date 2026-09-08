import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { PaymentEntity } from '../payment/entities/payment.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { ProductEntity } from '../product/entities/product.entity';
import { ProductVariantEntity } from '../product/entities/product-variant.entity';
import { CartSignalEntity } from '../cart/cart-signal.entity';
import { SmsEventLogEntity } from '../cart/sms-event-log.entity';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationJobs {
  private readonly logger = new Logger(NotificationJobs.name);

  constructor(
    private readonly notifications: NotificationService,
    @InjectRepository(PaymentEntity) private readonly payments: Repository<PaymentEntity>,
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(CustomerEntity) private readonly customers: Repository<CustomerEntity>,
    @InjectRepository(ProductVariantEntity) private readonly variants: Repository<ProductVariantEntity>,
    @InjectRepository(ProductEntity) private readonly products: Repository<ProductEntity>,
    @InjectRepository(CartSignalEntity) private readonly carts: Repository<CartSignalEntity>,
    @InjectRepository(SmsEventLogEntity) private readonly logs: Repository<SmsEventLogEntity>,
  ) {}

  private async claim(eventKey: string, event: string, channel?: string): Promise<boolean> {
    try {
      await this.logs.insert({ eventKey, event, channel: channel ?? null });
      return true;
    } catch {
      return false;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async paidOrderAdminSms() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await this.payments.find({
      where: { status: 'PAID', paidAt: MoreThan(since) },
      take: 40,
      order: { paidAt: 'DESC' },
    });
    for (const pay of rows) {
      if (!pay.orderId) continue;
      const key = `orderPaid:${pay.orderId}`;
      if (!(await this.claim(key, 'orderPaidAdmin'))) continue;
      const order = await this.orders.findOne({ where: { id: pay.orderId } });
      if (!order) continue;
      const channel =
        String(order.type || '').toUpperCase() === 'RETAIL_WEBSITE' || String(order.type || '').toUpperCase() === 'RETAIL'
          ? 'RETAIL'
          : 'WHOLESALE';
      let label: string | undefined;
      if (order.customerId) {
        const c = await this.customers.findOne({ where: { id: order.customerId } });
        label = c?.businessName || c?.ownerName || undefined;
      }
      await this.notifications.orderPaidAdmin(channel, order.orderNumber, label);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async pruneCartSignals() {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    await this.carts
      .createQueryBuilder()
      .delete()
      .where('"lastItemAt" < :cutoff', { cutoff })
      .execute();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async abandonedCartSms() {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    const rows = await this.carts.find({
      where: { lastItemAt: LessThan(cutoff), reminderSentAt: IsNull() },
      take: 30,
    });
    for (const row of rows) {
      if (!row.phone) {
        row.reminderSentAt = new Date();
        await this.carts.save(row);
        continue;
      }
      const recentOrder = await this.orders
        .createQueryBuilder('o')
        .innerJoin('o.customer', 'c')
        .where('c.phone = :phone', { phone: row.phone })
        .andWhere('o.createdAt >= :since', { since: row.lastItemAt })
        .getCount();
      row.reminderSentAt = new Date();
      await this.carts.save(row);
      if (recentOrder > 0) continue;
      const key = `abandoned:${row.channel}:${row.sessionId}:${row.lastItemAt.toISOString()}`;
      if (!(await this.claim(key, 'abandonedCart', row.channel))) continue;
      await this.notifications.abandonedCart(row.channel, row.phone);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async stockOutAdminSms() {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const variants = await this.variants
      .createQueryBuilder('v')
      .where('v.updatedAt >= :since', { since })
      .andWhere('(COALESCE(v.retailStock, 0) = 0 OR COALESCE(v.wholesaleStock, 0) = 0)')
      .take(40)
      .getMany();
    const day = new Date().toISOString().slice(0, 10);
    const productIds = [...new Set(variants.map((v) => v.productId))];
    for (const productId of productIds) {
      const product = await this.products.findOne({ where: { id: productId } });
      if (!product) continue;
      const all = await this.variants.find({ where: { productId } });
      const retail = all.reduce((s, x) => s + (Number(x.retailStock) || 0), 0);
      const wholesale = all.reduce((s, x) => s + (Number(x.wholesaleStock) || 0), 0);
      if (retail === 0) {
        const key = `stockOut:RETAIL:${productId}:${day}`;
        if (await this.claim(key, 'stockOutAdmin', 'RETAIL')) {
          await this.notifications.stockOutAdmin('RETAIL', product.name);
        }
      }
      if (wholesale === 0) {
        const key = `stockOut:WHOLESALE:${productId}:${day}`;
        if (await this.claim(key, 'stockOutAdmin', 'WHOLESALE')) {
          await this.notifications.stockOutAdmin('WHOLESALE', product.name);
        }
      }
    }
  }
}

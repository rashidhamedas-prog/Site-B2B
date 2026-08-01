import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderEntity } from '../order/entities/order.entity';
import { ProductEntity } from '../product/entities/product.entity';
import { SettingsService } from '../settings/settings.service';

type TorobProduct = {
  product_url: string;
  product_price: number;
  quantity: number;
};

type TorobOrder = {
  purchase_timestamp: string;
  last_updated_timestamp: string;
  torob_clid: string;
  status: 'completed' | 'cancelled';
  psp?: string;
  order_value?: number;
  shipping_amount?: number;
  phone_number?: string;
  products?: TorobProduct[];
};

@Injectable()
export class TorobService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    private readonly settings: SettingsService,
  ) {}

  private retailBase() {
    return (process.env.NEXT_PUBLIC_RETAIL_URL || 'https://www.poshaktaranom.ir').replace(/\/$/, '');
  }

  private toIsoUtc(d: Date) {
    return new Date(d).toISOString();
  }

  /** IRR → Toman integer for Torob. */
  private toman(irr: number) {
    return Math.max(0, Math.round(Number(irr || 0) / 10));
  }

  private mapStatus(order: OrderEntity): 'completed' | 'cancelled' | null {
    if (order.voidedAt || order.status === 'CANCELLED' || order.status === 'DELETED' || order.status === 'VOIDED') {
      return 'cancelled';
    }
    // Only expose attributed orders that progressed past draft/pending unpaid
    if (['PENDING_REVIEW', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status)) {
      return 'completed';
    }
    return null;
  }

  async assertEnabled() {
    const m = await this.settings.marketing();
    if (m.torobOrderSyncEnabled !== true) {
      throw new ForbiddenException('Torob order sync is disabled');
    }
  }

  async listOrders(purchaseTimestampGt: string, limit: number) {
    await this.assertEnabled();

    const gt = new Date(purchaseTimestampGt);
    if (Number.isNaN(gt.getTime())) {
      return { success: true as const, data: [] as TorobOrder[] };
    }

    const take = Math.min(1000, Math.max(1, limit || 100));
    const rows = await this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('o.customer', 'customer')
      .where('o."torobClid" IS NOT NULL')
      .andWhere('(o."createdAt" > :gt OR o."updatedAt" > :gt)', { gt })
      .andWhere('o."deletedAt" IS NULL')
      .orderBy('o."createdAt"', 'ASC')
      .take(take)
      .getMany();

    const skus = [
      ...new Set(rows.flatMap((o) => (o.items || []).map((i) => i.sku).filter(Boolean))),
    ];
    const productRows =
      skus.length > 0 ? await this.products.find({ where: { sku: In(skus) } }) : [];
    const bySku = new Map(productRows.map((p) => [p.sku, p]));

    const base = this.retailBase();
    const data: TorobOrder[] = [];

    for (const o of rows) {
      const status = this.mapStatus(o);
      if (!status) continue;

      const products: TorobProduct[] = (o.items || []).map((it) => {
        const p = bySku.get(it.sku);
        const slug = p?.slug || it.sku;
        return {
          product_url: `${base}/products/${encodeURI(slug)}`,
          product_price: this.toman(Number(it.unitPrice)),
          quantity: Number(it.quantity) || 1,
        };
      });

      const row: TorobOrder = {
        purchase_timestamp: this.toIsoUtc(o.createdAt),
        last_updated_timestamp: this.toIsoUtc(o.updatedAt || o.createdAt),
        torob_clid: String(o.torobClid),
        status,
        order_value: this.toman(Number(o.subtotal) - Number(o.discount || 0)),
        shipping_amount: this.toman(Number(o.shippingFee || 0)),
        products,
      };

      if (o.paymentMethod === 'ONLINE' || o.paymentMethod === 'ZARINPAL') {
        row.psp = 'zarinpal';
      }
      const phone = (o.customer as any)?.phone || (o.customer as any)?.mobile;
      if (phone) row.phone_number = String(phone);

      data.push(row);
    }

    return { success: true as const, data };
  }
}

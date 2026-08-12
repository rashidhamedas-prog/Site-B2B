import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { IntegrationHealthTracker } from '../../common/integration-health';
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

/**
 * Torob order-tracking sync (official Torob-Sync contract only).
 * Do not invent private Torob write/catalog APIs — catalog is feeds/torob.xml.
 *
 * Retry: listOrders is a read-only GET; responses are deterministic for a given
 * purchase_timestamp_gt window — safe and idempotent to retry.
 */
@Injectable()
export class TorobService {
  private readonly logger = new Logger(TorobService.name);
  private readonly tracker = new IntegrationHealthTracker();

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
    if (['PENDING_REVIEW', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status)) {
      return 'completed';
    }
    return null;
  }

  health() {
    const snap = this.tracker.snapshot();
    const ok =
      snap.errorCount === 0 ||
      (snap.lastSuccessAt != null &&
        (snap.lastErrorAt == null || snap.lastSuccessAt >= snap.lastErrorAt));
    return {
      integration: 'torob' as const,
      ok,
      ...snap,
      retry: {
        idempotent: true,
        notes:
          'GET /torob/v1/orders is read-only order export per Torob-Sync; safe to retry. Catalog crawl uses public feeds/torob.xml — no private Torob product write API invented here.',
      },
    };
  }

  async assertEnabled() {
    const m = await this.settings.marketing();
    if (m.torobOrderSyncEnabled !== true) {
      throw new ForbiddenException('Torob order sync is disabled');
    }
  }

  async listOrders(purchaseTimestampGt: string | undefined, limitRaw: number | undefined) {
    try {
      await this.assertEnabled();
    } catch (err) {
      this.tracker.recordError(err instanceof Error ? err.message : String(err), { op: 'assertEnabled' });
      throw err;
    }

    // Panel health-check may omit params — respond 200 empty JSON rather than 400/500.
    if (!purchaseTimestampGt?.trim()) {
      this.tracker.recordSuccess({ op: 'listOrders', emptyProbe: true, count: 0 });
      return { success: true as const, data: [] as TorobOrder[] };
    }

    const gt = new Date(purchaseTimestampGt);
    if (Number.isNaN(gt.getTime())) {
      this.tracker.recordSuccess({ op: 'listOrders', invalidTs: true, count: 0 });
      return { success: true as const, data: [] as TorobOrder[] };
    }

    const take = Math.min(1000, Math.max(1, Number.isFinite(limitRaw!) ? Number(limitRaw) : 100));

    let rows: OrderEntity[] = [];
    try {
      rows = await this.orders.find({
        where: [
          { torobClid: Not(IsNull()), createdAt: MoreThan(gt) },
          { torobClid: Not(IsNull()), updatedAt: MoreThan(gt) },
        ],
        relations: ['items', 'customer'],
        order: { createdAt: 'ASC' },
        take,
      });
    } catch (err) {
      this.logger.error(`Torob listOrders query failed: ${err instanceof Error ? err.message : err}`);
      this.tracker.recordError(err instanceof Error ? err.message : String(err), { op: 'listOrders.query' });
      // Never 500 the Torob panel — empty list is safer than breaking validation.
      return { success: true as const, data: [] as TorobOrder[] };
    }

    // De-dupe OR matches
    const seen = new Set<string>();
    rows = rows.filter((o) => {
      if (!o.torobClid || seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });

    const skus = [...new Set(rows.flatMap((o) => (o.items || []).map((i) => i.sku).filter(Boolean)))];
    let bySku = new Map<string, ProductEntity>();
    try {
      if (skus.length > 0) {
        const productRows = await this.products.find({ where: { sku: In(skus) } });
        bySku = new Map(productRows.map((p) => [p.sku, p]));
      }
    } catch (err) {
      this.logger.warn(`Torob product lookup failed: ${err instanceof Error ? err.message : err}`);
    }

    const base = this.retailBase();
    const data: TorobOrder[] = [];

    for (const o of rows) {
      const status = this.mapStatus(o);
      if (!status) continue;

      const products: TorobProduct[] = (o.items || []).map((it) => {
        const p = bySku.get(it.sku);
        const slug = p?.slug || it.sku;
        return {
          product_url: `${base}/products/${encodeURIComponent(slug).replace(/%2F/gi, '/')}`,
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

    this.tracker.recordSuccess({ op: 'listOrders', count: data.length });
    return { success: true as const, data };
  }
}

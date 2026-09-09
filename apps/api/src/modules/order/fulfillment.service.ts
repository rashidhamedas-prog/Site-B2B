import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { OUTBOX_EVENT_TYPES } from '../omnichannel/omnichannel.constants';
import { OutboxService } from '../omnichannel/services/outbox.service';
import { VendorEntity } from '../vendor/entities/vendor.entity';
import { FulfillmentOrderItemEntity } from './entities/fulfillment-order-item.entity';
import { FulfillmentOrderEntity } from './entities/fulfillment-order.entity';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import {
  canPartnerAcceptStatus,
  canPartnerShipStatus,
  commissionAmountIrr,
  normalizeTrackingCode,
  partnerMayAccessFulfillment,
  shouldEnqueuePartnerNotify,
  splitLinesIntoParcels,
  toCustomerParcels,
  type SplitLine,
} from './fulfillment-split-policy';

@Injectable()
export class FulfillmentService {
  constructor(
    @InjectRepository(FulfillmentOrderEntity)
    private readonly fulfillmentRepo: Repository<FulfillmentOrderEntity>,
    private readonly outbox: OutboxService,
  ) {}

  /** Idempotent: one parcel set per order after stock settle / paid confirm. */
  async ensureSplit(order: OrderEntity, manager: EntityManager): Promise<void> {
    const foRepo = manager.getRepository(FulfillmentOrderEntity);
    const existing = await foRepo.count({ where: { orderId: order.id } });
    if (existing > 0) return;

    const items = (order.items ?? []) as OrderItemEntity[];
    if (!items.length) return;

    const lines: SplitLine[] = items.map((it) => ({
      id: it.id,
      vendorId: it.vendorId ?? null,
      commissionPercent: it.commissionPercent ?? null,
      totalPrice: Number(it.totalPrice) || 0,
      quantity: Number(it.quantity) || 0,
      productName: it.productName,
      sku: it.sku,
      color: it.color,
      size: it.size,
      imageUrl: it.imageUrl ?? null,
    }));
    const groups = splitLinesIntoParcels(lines);
    const vendorIds = groups.map((g) => g.vendorId).filter((id): id is string => !!id);
    const vendors = vendorIds.length
      ? await manager.getRepository(VendorEntity).find({ where: { id: In(vendorIds) } })
      : [];
    const slaByVendor = new Map(vendors.map((v) => [v.id, v.acceptSlaHours]));

    const now = Date.now();
    const itemRepo = manager.getRepository(FulfillmentOrderItemEntity);
    const channel = String(order.type || '').toUpperCase() === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';

    try {
      for (const group of groups) {
        const slaHours = group.vendorId ? (slaByVendor.get(group.vendorId) ?? 12) : null;
        const row = await foRepo.save(
          foRepo.create({
            orderId: order.id,
            vendorId: group.vendorId,
            parcelIndex: group.parcelIndex,
            parcelLabel: group.parcelLabel,
            status: group.status,
            acceptBy:
              group.vendorId && slaHours != null
                ? new Date(now + slaHours * 60 * 60 * 1000)
                : null,
            goodsTotal: group.goodsTotal,
            shippingFee: 0,
            commissionTotal: group.commissionTotal,
          }),
        );
        await itemRepo.save(
          group.items.map((it) =>
            itemRepo.create({
              fulfillmentOrderId: row.id,
              orderItemId: it.id,
              productName: it.productName,
              sku: it.sku,
              color: it.color,
              size: it.size,
              imageUrl: it.imageUrl ?? null,
              quantity: it.quantity,
              lineTotal: Math.floor(Number(it.totalPrice) || 0),
              commissionPercent: it.commissionPercent ?? null,
              commissionAmount: commissionAmountIrr(
                Number(it.totalPrice) || 0,
                it.commissionPercent,
              ),
            }),
          ),
        );

        if (shouldEnqueuePartnerNotify(row.vendorId, row.status)) {
          await this.outbox.enqueue(
            {
              operationId: `${row.id}:notify:pending`,
              eventType: OUTBOX_EVENT_TYPES.FULFILLMENT_PENDING_ACCEPT_NOTIFICATION,
              aggregateType: 'FULFILLMENT_ORDER',
              aggregateId: row.id,
              channel,
              payload: {
                fulfillmentOrderId: row.id,
                vendorId: row.vendorId,
                orderId: order.id,
                orderNumber: order.orderNumber,
                parcelLabel: row.parcelLabel,
                acceptBy: row.acceptBy ? row.acceptBy.toISOString() : null,
                acceptSlaHours: slaHours,
              },
            },
            manager,
          );
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === '23505') return;
      throw err;
    }
  }

  async parcelsForOrder(orderId: string) {
    return this.fulfillmentRepo.find({
      where: { orderId },
      relations: ['items'],
      order: { parcelIndex: 'ASC' },
    });
  }

  customerParcels(rows: FulfillmentOrderEntity[]) {
    return toCustomerParcels(rows);
  }

  async listForVendor(vendorId: string) {
    if (!vendorId) return { data: [] };
    const rows = await this.fulfillmentRepo.find({
      where: { vendorId },
      relations: ['items', 'order'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return { data: rows.map((row) => this.toPartnerView(row)) };
  }

  async acceptForVendor(id: string, vendorId: string | undefined) {
    const row = await this.fulfillmentRepo.findOne({
      where: { id },
      relations: ['items', 'order'],
    });
    if (!row) throw new NotFoundException('مرسوله پیدا نشد');
    if (!partnerMayAccessFulfillment(vendorId, row.vendorId)) {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }
    if (!canPartnerAcceptStatus(row.status)) {
      throw new BadRequestException('این مرسوله قابل قبول نیست');
    }
    row.status = 'ACCEPTED';
    await this.fulfillmentRepo.save(row);
    return this.toPartnerView(row);
  }

  async shipForVendor(
    id: string,
    vendorId: string | undefined,
    trackingCodeRaw: unknown,
  ) {
    const trackingCode = normalizeTrackingCode(trackingCodeRaw);
    if (!trackingCode) {
      throw new BadRequestException('کد رهگیری معتبر وارد کنید');
    }
    const row = await this.fulfillmentRepo.findOne({
      where: { id },
      relations: ['items', 'order'],
    });
    if (!row) throw new NotFoundException('مرسوله پیدا نشد');
    if (!partnerMayAccessFulfillment(vendorId, row.vendorId)) {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }
    if (!canPartnerShipStatus(row.status)) {
      throw new BadRequestException('فقط مرسولهٔ قبول‌شده قابل ارسال است');
    }
    row.status = 'SHIPPED';
    row.trackingCode = trackingCode;
    await this.fulfillmentRepo.save(row);

    const channel =
      String(row.order?.type || '').toUpperCase() === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
    await this.outbox.enqueue({
      operationId: `${row.id}:notify:shipped`,
      eventType: OUTBOX_EVENT_TYPES.FULFILLMENT_SHIPPED_NOTIFICATION,
      aggregateType: 'FULFILLMENT_ORDER',
      aggregateId: row.id,
      channel,
      payload: {
        fulfillmentOrderId: row.id,
        orderId: row.orderId,
        orderNumber: row.order?.orderNumber ?? null,
        parcelLabel: row.parcelLabel,
        trackingCode,
      },
    });

    return this.toPartnerView(row);
  }

  private toPartnerView(row: FulfillmentOrderEntity) {
    const order = row.order;
    return {
      id: row.id,
      parcelLabel: row.parcelLabel,
      parcelIndex: row.parcelIndex,
      status: row.status,
      acceptBy: row.acceptBy,
      trackingCode: row.trackingCode ?? null,
      goodsTotal: row.goodsTotal,
      shippingFee: 0,
      commissionTotal: row.commissionTotal,
      orderNumber: order?.orderNumber ?? null,
      shippingAddress: order?.shippingAddress ?? null,
      shippingNote:
        'هزینه پست واقعی را خودتان می‌پردازید. مبلغ ارسال مشتری برای ترنم است و به همکار برنمی‌گردد.',
      items: (row.items ?? []).map((it) => ({
        productName: it.productName,
        sku: it.sku,
        color: it.color,
        size: it.size,
        quantity: it.quantity,
        lineTotal: it.lineTotal,
        imageUrl: it.imageUrl,
      })),
    };
  }
}

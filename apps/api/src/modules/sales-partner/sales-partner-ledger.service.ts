import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../order/entities/order.entity';
import { OrderItemEntity } from '../order/entities/order-item.entity';
import {
  SalesCommissionLedgerEntryEntity,
  SalesCommissionSnapshotEntity,
  SalesPartnerOrderDraftEntity,
  SalesPartnerOrderDraftItemEntity,
} from './entities';
import { SalesPartnerService } from './sales-partner.service';
import {
  availableAtFromDelivery,
  canAutoRelease,
  earnedIdempotencyKey,
  ledgerBalance,
  reversalIdempotencyKey,
} from './sales-partner-ledger-policy';

const PAID_STATUSES = [
  'PENDING_REVIEW',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
];
const REVERSE_STATUSES = ['CANCELLED', 'DELETED', 'RETURNED', 'REFUNDED'];
const DELIVERED_STATUSES = ['DELIVERED', 'COMPLETED'];

@Injectable()
export class SalesPartnerLedgerService {
  private readonly logger = new Logger(SalesPartnerLedgerService.name);

  constructor(
    @InjectRepository(SalesPartnerOrderDraftEntity)
    private readonly drafts: Repository<SalesPartnerOrderDraftEntity>,
    @InjectRepository(SalesPartnerOrderDraftItemEntity)
    private readonly draftItems: Repository<SalesPartnerOrderDraftItemEntity>,
    @InjectRepository(SalesCommissionSnapshotEntity)
    private readonly snapshots: Repository<SalesCommissionSnapshotEntity>,
    @InjectRepository(SalesCommissionLedgerEntryEntity)
    private readonly entries: Repository<SalesCommissionLedgerEntryEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItems: Repository<OrderItemEntity>,
    private readonly program: SalesPartnerService,
  ) {}

  async syncConverted(limit = 50) {
    const drafts = await this.drafts.find({
      where: { status: 'CONVERTED_TO_ORDER' },
      order: { updatedAt: 'DESC' },
      take: limit,
    });
    let n = 0;
    for (const draft of drafts) {
      if (!draft.convertedOrderId) continue;
      try {
        n += await this.syncDraft(draft);
      } catch (err) {
        this.logger.warn(`ledger sync ${draft.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return n;
  }

  async balances(salesPartnerId: string) {
    const rows = await this.entries.find({ where: { salesPartnerId }, take: 500, order: { createdAt: 'DESC' } });
    const mapped = rows.map((row) => ({
      amountIrr: Number(row.amountIrr),
      entryType: row.entryType as 'COMMISSION_EARNED' | 'COMMISSION_REVERSAL' | 'MANUAL_ADJUSTMENT' | 'PAYOUT' | 'PAYOUT_REVERSAL',
      availableAt: row.availableAt,
      payoutId: row.payoutId,
    }));
    return {
      ...ledgerBalance(mapped, new Date()),
      entries: rows.map((row) => ({
        id: row.id,
        orderId: row.orderId,
        amountIrr: Number(row.amountIrr),
        entryType: row.entryType,
        availableAt: row.availableAt,
        reasonCode: row.reasonCode,
        createdAt: row.createdAt,
      })),
    };
  }

  private async syncDraft(draft: SalesPartnerOrderDraftEntity) {
    const order = await this.orders.findOne({ where: { id: draft.convertedOrderId! } });
    if (!order) return 0;
    const items = await this.orderItems.find({ where: { orderId: order.id } });
    await this.ensureSnapshots(draft, items);
    const snaps = await this.snapshots.find({ where: { orderId: order.id, salesPartnerId: draft.salesPartnerId } });
    let writes = 0;
    if (PAID_STATUSES.includes(order.status)) {
      const settings = await this.program.settings();
      const delivered = DELIVERED_STATUSES.includes(order.status) && order.deliveredAt;
      const availableAt = delivered && canAutoRelease(settings.commissionHoldDays)
        ? availableAtFromDelivery(order.deliveredAt, settings.commissionHoldDays as number)
        : null;
      for (const snap of snaps) {
        writes += await this.insertIgnore({
          salesPartnerId: draft.salesPartnerId,
          orderId: order.id,
          orderItemId: snap.orderItemId,
          amountIrr: Number(snap.commissionIrr),
          entryType: 'COMMISSION_EARNED',
          availableAt,
          idempotencyKey: earnedIdempotencyKey(order.id, snap.orderItemId),
          reasonCode: delivered ? 'DELIVERED_HOLD' : 'PAID_PENDING',
        });
      }
    }
    if (REVERSE_STATUSES.includes(order.status)) {
      for (const snap of snaps) {
        writes += await this.insertIgnore({
          salesPartnerId: draft.salesPartnerId,
          orderId: order.id,
          orderItemId: snap.orderItemId,
          amountIrr: -Number(snap.commissionIrr),
          entryType: 'COMMISSION_REVERSAL',
          availableAt: new Date(),
          idempotencyKey: reversalIdempotencyKey(order.id, snap.orderItemId, order.status),
          reasonCode: order.status,
        });
      }
    }
    return writes;
  }

  private async ensureSnapshots(draft: SalesPartnerOrderDraftEntity, items: OrderItemEntity[]) {
    const existing = await this.snapshots.count({ where: { orderId: draft.convertedOrderId! } });
    if (existing > 0) return;
    const source = await this.draftItems.find({ where: { draftId: draft.id } });
    for (const item of items) {
      const match = source.find((row) => row.variantId === item.productVariantId)
        || source.find((row) => row.productName === item.productName);
      const commissionIrr = match?.estimatedCommissionIrr ?? 0;
      const eligibleNetIrr = Number(item.totalPrice || 0);
      await this.snapshots.save(this.snapshots.create({
        orderId: draft.convertedOrderId!,
        orderItemId: item.id,
        salesPartnerId: draft.salesPartnerId,
        ruleId: null,
        ruleVersion: 1,
        percent: eligibleNetIrr > 0 ? Math.floor((commissionIrr * 100) / eligibleNetIrr) : 0,
        eligibleNetIrr: String(eligibleNetIrr),
        commissionIrr: String(commissionIrr),
      }));
    }
  }

  private async insertIgnore(row: {
    salesPartnerId: string;
    orderId: string;
    orderItemId: string;
    amountIrr: number;
    entryType: string;
    availableAt: Date | null;
    idempotencyKey: string;
    reasonCode: string;
  }) {
    const found = await this.entries.findOne({ where: { idempotencyKey: row.idempotencyKey } });
    if (found) {
      if (row.entryType === 'COMMISSION_EARNED' && row.availableAt && !found.availableAt) {
        found.availableAt = row.availableAt;
        found.reasonCode = row.reasonCode;
        await this.entries.save(found);
        return 1;
      }
      return 0;
    }
    try {
      await this.entries.save(this.entries.create({
        ...row,
        amountIrr: String(row.amountIrr),
        createdBy: null,
      }));
      return 1;
    } catch {
      return 0;
    }
  }
}

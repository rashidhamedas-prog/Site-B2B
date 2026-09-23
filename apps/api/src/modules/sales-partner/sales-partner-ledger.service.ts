import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { OrderEntity } from '../order/entities/order.entity';
import { OrderItemEntity } from '../order/entities/order-item.entity';
import { ProductVariantEntity } from '../product/entities/product-variant.entity';
import { ReturnRequestEntity } from '../rma/entities/return-request.entity';
import {
  SalesCommissionLedgerEntryEntity,
  SalesCommissionSnapshotEntity,
  SalesPartnerOrderDraftEntity,
  SalesPartnerOrderDraftItemEntity,
} from './entities';
import {
  isApprovedReturnStatus,
  isFullOrderReversalStatus,
  remainingReversalIrr,
  snapshotLineCommissions,
} from './sales-commission-policy';
import { SalesPartnerCatalogService } from './sales-partner-catalog.service';
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
    @InjectRepository(ReturnRequestEntity)
    private readonly returns: Repository<ReturnRequestEntity>,
    @InjectRepository(ProductVariantEntity)
    private readonly variants: Repository<ProductVariantEntity>,
    private readonly catalog: SalesPartnerCatalogService,
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

  async syncLinkOrders(limit = 50) {
    const orders = await this.orders.find({
      where: {
        salesSource: 'SALES_PARTNER',
        salesPartnerSubmissionId: IsNull(),
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    let n = 0;
    for (const order of orders) {
      if (!order.salesPartnerId) continue;
      try {
        const items = await this.orderItems.find({ where: { orderId: order.id } });
        await this.ensureLinkSnapshots(order, items);
        n += await this.applyOrderLedger(order.salesPartnerId, order);
      } catch (err) {
        this.logger.warn(`link ledger sync ${order.id}: ${err instanceof Error ? err.message : String(err)}`);
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
    await this.ensureSnapshots(draft, order, items);
    return this.applyOrderLedger(draft.salesPartnerId, order);
  }

  private async applyOrderLedger(salesPartnerId: string, order: OrderEntity) {
    const snaps = await this.snapshots.find({ where: { orderId: order.id, salesPartnerId } });
    let writes = 0;
    if (PAID_STATUSES.includes(order.status)) {
      const settings = await this.program.settings();
      const delivered = DELIVERED_STATUSES.includes(order.status) && order.deliveredAt;
      const availableAt = delivered && canAutoRelease(settings.commissionHoldDays)
        ? availableAtFromDelivery(order.deliveredAt, settings.commissionHoldDays as number)
        : null;
      for (const snap of snaps) {
        writes += await this.insertIgnore({
          salesPartnerId,
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
    writes += await this.reverseApprovedReturns(salesPartnerId, order, snaps);
    if (isFullOrderReversalStatus(order.status)) {
      writes += await this.reverseRemaining(salesPartnerId, order, snaps, order.status);
    }
    return writes;
  }

  private async reverseApprovedReturns(
    salesPartnerId: string,
    order: OrderEntity,
    snaps: SalesCommissionSnapshotEntity[],
  ) {
    const rows = await this.returns.find({
      where: {
        orderId: order.id,
        requestType: 'RETURN',
        status: In(['APPROVED', 'COMPLETED']),
      },
    });
    let writes = 0;
    for (const rma of rows) {
      if (!isApprovedReturnStatus(rma.status)) continue;
      const snap = snaps.find((row) => row.orderItemId === rma.orderItemId);
      if (!snap) continue;
      writes += await this.reverseEarnedRemainder({
        salesPartnerId,
        orderId: order.id,
        orderItemId: rma.orderItemId,
        earnedIrr: Number(snap.commissionIrr),
        reason: `RMA:${rma.id}`,
      });
    }
    return writes;
  }

  private async reverseRemaining(
    salesPartnerId: string,
    order: OrderEntity,
    snaps: SalesCommissionSnapshotEntity[],
    reason: string,
  ) {
    let writes = 0;
    for (const snap of snaps) {
      writes += await this.reverseEarnedRemainder({
        salesPartnerId,
        orderId: order.id,
        orderItemId: snap.orderItemId,
        earnedIrr: Number(snap.commissionIrr),
        reason,
      });
    }
    return writes;
  }

  private async reverseEarnedRemainder(input: {
    salesPartnerId: string;
    orderId: string;
    orderItemId: string;
    earnedIrr: number;
    reason: string;
  }) {
    const earned = await this.entries.findOne({
      where: { idempotencyKey: earnedIdempotencyKey(input.orderId, input.orderItemId) },
    });
    if (!earned) return 0;
    const prior = await this.entries.find({
      where: { orderId: input.orderId, orderItemId: input.orderItemId, entryType: 'COMMISSION_REVERSAL' },
    });
    const already = prior.reduce((sum, row) => sum + Math.abs(Number(row.amountIrr)), 0);
    const remaining = remainingReversalIrr(input.earnedIrr, already);
    if (remaining <= 0) return 0;
    return this.insertIgnore({
      salesPartnerId: input.salesPartnerId,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      amountIrr: -remaining,
      entryType: 'COMMISSION_REVERSAL',
      availableAt: new Date(),
      idempotencyKey: reversalIdempotencyKey(input.orderId, input.orderItemId, input.reason),
      reasonCode: input.reason,
    });
  }

  private async ensureSnapshots(draft: SalesPartnerOrderDraftEntity, order: OrderEntity, items: OrderItemEntity[]) {
    const existing = await this.snapshots.count({ where: { orderId: draft.convertedOrderId! } });
    if (existing > 0) return;
    const source = await this.draftItems.find({ where: { draftId: draft.id } });
    const lines = items.map((item) => {
      const match = source.find((row) => row.variantId && row.variantId === item.productVariantId)
        || source.find((row) => row.productName === item.productName);
      return {
        orderItemId: item.id,
        lineTotalIrr: Number(item.totalPrice || 0),
        percent: match?.commissionPercent ?? 0,
        ruleId: match?.ruleId ?? null,
        ruleVersion: match?.ruleVersion ?? 1,
      };
    });
    const computed = snapshotLineCommissions({
      lines,
      orderDiscountIrr: Number(order.discount || 0),
      walletAppliedIrr: Number(order.walletApplied || 0),
    });
    for (const snap of computed) {
      const meta = lines.find((line) => line.orderItemId === snap.orderItemId);
      await this.snapshots.save(this.snapshots.create({
        orderId: draft.convertedOrderId!,
        orderItemId: snap.orderItemId,
        salesPartnerId: draft.salesPartnerId,
        ruleId: meta?.ruleId ?? null,
        ruleVersion: meta?.ruleVersion ?? 1,
        percent: snap.percent,
        eligibleNetIrr: String(snap.eligibleNetIrr),
        commissionIrr: String(snap.commissionIrr),
      }));
    }
  }

  private async ensureLinkSnapshots(order: OrderEntity, items: OrderItemEntity[]) {
    if (!order.salesPartnerId) return;
    const existing = await this.snapshots.count({ where: { orderId: order.id } });
    if (existing > 0) return;
    const clicked = new Set(order.salesPartnerProductIds || []);
    if (!clicked.size) return;
    const variantIds = [...new Set(items.map((item) => item.productVariantId))];
    const variants = variantIds.length
      ? await this.variants.find({ where: { id: In(variantIds) } })
      : [];
    const productByVariant = new Map(variants.map((row) => [row.id, row.productId]));
    const clickedLines = new Map<string, { percent: number; ruleId: string | null; ruleVersion: number }>();
    for (const item of items) {
      const productId = productByVariant.get(item.productVariantId);
      if (!productId || !clicked.has(productId)) continue;
      const lineTotal = Math.max(0, Math.floor(Number(item.totalPrice || 0)));
      const preview = await this.catalog.preview(order.salesPartnerId, productId, lineTotal);
      clickedLines.set(item.id, {
        percent: preview.percent,
        ruleId: preview.ruleId,
        ruleVersion: preview.ruleVersion,
      });
    }
    if (!clickedLines.size) return;
    const lines = items.map((item) => {
      const meta = clickedLines.get(item.id);
      return {
        orderItemId: item.id,
        lineTotalIrr: Math.max(0, Math.floor(Number(item.totalPrice || 0))),
        percent: meta?.percent ?? 0,
      };
    });
    const computed = snapshotLineCommissions({
      lines,
      orderDiscountIrr: Number(order.discount || 0),
      walletAppliedIrr: Number(order.walletApplied || 0),
    });
    for (const snap of computed) {
      const meta = clickedLines.get(snap.orderItemId);
      if (!meta) continue;
      await this.snapshots.save(this.snapshots.create({
        orderId: order.id,
        orderItemId: snap.orderItemId,
        salesPartnerId: order.salesPartnerId,
        ruleId: meta.ruleId,
        ruleVersion: meta.ruleVersion,
        percent: snap.percent,
        eligibleNetIrr: String(snap.eligibleNetIrr),
        commissionIrr: String(snap.commissionIrr),
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

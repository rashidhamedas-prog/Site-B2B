import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { isUniqueViolation } from './sales-partner-referral-policy';
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

  async syncConverted(limit = 200) {
    const result = await this.syncPending(limit);
    return result.wrote;
  }

  async syncLinkOrders(limit = 200) {
    const result = await this.syncPending(limit);
    return result.wrote;
  }

  async syncPending(limit = 200): Promise<{ wrote: number; failed: number; backlog: number }> {
    const rows = (await this.orders.manager.query(
      `SELECT o.id
       FROM orders o
       LEFT JOIN sales_partner_ledger_retries r ON r."orderId" = o.id
       WHERE o."salesPartnerId" IS NOT NULL
         AND (r."orderId" IS NULL OR r."nextAttemptAt" <= NOW())
         AND (
           o."salesPartnerLedgerAppliedAt" IS NULL
           OR o."updatedAt" > o."salesPartnerLedgerAppliedAt"
         )
       ORDER BY o."updatedAt" ASC, o.id ASC
       LIMIT $1`,
      [limit],
    )) as Array<{ id: string }>;
    const backlogRows = (await this.orders.manager.query(
      `SELECT COUNT(*)::int AS n
       FROM orders o
       WHERE o."salesPartnerId" IS NOT NULL
         AND (
           o."salesPartnerLedgerAppliedAt" IS NULL
           OR o."updatedAt" > o."salesPartnerLedgerAppliedAt"
         )`,
    )) as Array<{ n: number }>;
    let wrote = 0;
    let failed = 0;
    for (const row of rows) {
      const order = await this.orders.findOne({ where: { id: row.id } });
      if (!order?.salesPartnerId) continue;
      const seenAt = order.updatedAt;
      try {
        if (order.salesPartnerSubmissionId) {
          const draft = await this.drafts.findOne({ where: { id: order.salesPartnerSubmissionId } });
          if (draft) wrote += await this.syncDraft(draft);
        } else {
          const items = await this.orderItems.find({ where: { orderId: order.id } });
          await this.ensureLinkSnapshots(order, items);
          wrote += await this.applyOrderLedger(order.salesPartnerId, order);
        }
        await this.orders.update(order.id, { salesPartnerLedgerAppliedAt: seenAt } as any);
        await this.orders.manager.query(`DELETE FROM sales_partner_ledger_retries WHERE "orderId" = $1`, [order.id]);
      } catch (err) {
        if (isUniqueViolation(err)) {
          await this.orders.update(order.id, { salesPartnerLedgerAppliedAt: seenAt } as any);
          continue;
        }
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`ledger sync ${order.id}: ${message}`);
        await this.orders.manager.query(
          `INSERT INTO sales_partner_ledger_retries ("orderId", attempts, "lastError", "nextAttemptAt")
           VALUES ($1, 1, $2, NOW() + interval '10 minutes')
           ON CONFLICT ("orderId") DO UPDATE SET
             attempts = sales_partner_ledger_retries.attempts + 1,
             "lastError" = EXCLUDED."lastError",
             "nextAttemptAt" = NOW() + interval '10 minutes'`,
          [order.id, message.slice(0, 500)],
        );
      }
    }
    return { wrote, failed, backlog: Number(backlogRows[0]?.n || 0) };
  }

  async balances(salesPartnerId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(50, Math.max(1, pageSize));
    const totals = (await this.entries.manager.query(
      `SELECT
         COALESCE(SUM(CASE WHEN "entryType" = 'COMMISSION_REVERSAL' THEN ABS("amountIrr"::bigint) ELSE 0 END), 0)::text AS reversed,
         COALESCE(SUM(CASE WHEN "entryType" = 'PAYOUT' THEN ABS("amountIrr"::bigint) ELSE 0 END), 0)::text AS paid,
         COALESCE(SUM(CASE
           WHEN "entryType" IN ('COMMISSION_EARNED','MANUAL_ADJUSTMENT','PAYOUT_REVERSAL')
            AND ("availableAt" IS NULL OR "availableAt" > NOW()) THEN "amountIrr"::bigint
           ELSE 0 END), 0)::text AS held,
         COALESCE(SUM(CASE
           WHEN "entryType" IN ('COMMISSION_EARNED','MANUAL_ADJUSTMENT','PAYOUT_REVERSAL')
            AND "availableAt" IS NOT NULL AND "availableAt" <= NOW() THEN "amountIrr"::bigint
           WHEN "entryType" IN ('COMMISSION_REVERSAL','PAYOUT') THEN "amountIrr"::bigint
           ELSE 0 END), 0)::text AS available
       FROM sales_commission_ledger_entries
       WHERE "salesPartnerId" = $1`,
      [salesPartnerId],
    )) as Array<{ reversed: string; paid: string; held: string; available: string }>;
    const [rows, total] = await this.entries.findAndCount({
      where: { salesPartnerId },
      order: { createdAt: 'DESC' },
      take: safeSize,
      skip: (safePage - 1) * safeSize,
    });
    const row = totals[0];
    return {
      held: Number(row?.held || 0),
      available: Number(row?.available || 0),
      paid: Number(row?.paid || 0),
      reversed: Number(row?.reversed || 0),
      page: safePage,
      pageSize: safeSize,
      total,
      entries: rows.map((entry) => ({
        id: entry.id,
        orderId: entry.orderId,
        amountIrr: Number(entry.amountIrr),
        entryType: entry.entryType,
        availableAt: entry.availableAt,
        reasonCode: entry.reasonCode,
        createdAt: entry.createdAt,
      })),
    };
  }

  /** Program-wide rollup from the full ledger. */
  async programBalances() {
    const totals = (await this.entries.manager.query(
      `SELECT
         COALESCE(SUM(CASE WHEN "entryType" = 'COMMISSION_REVERSAL' THEN ABS("amountIrr"::bigint) ELSE 0 END), 0)::text AS reversed,
         COALESCE(SUM(CASE WHEN "entryType" = 'PAYOUT' THEN ABS("amountIrr"::bigint) ELSE 0 END), 0)::text AS paid,
         COALESCE(SUM(CASE
           WHEN "entryType" IN ('COMMISSION_EARNED','MANUAL_ADJUSTMENT','PAYOUT_REVERSAL')
            AND ("availableAt" IS NULL OR "availableAt" > NOW()) THEN "amountIrr"::bigint
           ELSE 0 END), 0)::text AS held,
         COALESCE(SUM(CASE
           WHEN "entryType" IN ('COMMISSION_EARNED','MANUAL_ADJUSTMENT','PAYOUT_REVERSAL')
            AND "availableAt" IS NOT NULL AND "availableAt" <= NOW() THEN "amountIrr"::bigint
           WHEN "entryType" IN ('COMMISSION_REVERSAL','PAYOUT') THEN "amountIrr"::bigint
           ELSE 0 END), 0)::text AS available,
         COUNT(*)::int AS sample
       FROM sales_commission_ledger_entries`,
    )) as Array<{ reversed: string; paid: string; held: string; available: string; sample: number }>;
    const row = totals[0];
    return {
      held: Number(row?.held || 0),
      available: Number(row?.available || 0),
      paid: Number(row?.paid || 0),
      reversed: Number(row?.reversed || 0),
      sampleSize: Number(row?.sample || 0),
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
    const existing = await this.snapshots.find({ where: { orderId: draft.convertedOrderId! } });
    const have = new Set(existing.map((row) => row.orderItemId));
    const source = await this.draftItems.find({ where: { draftId: draft.id } });
    const freeze = order.salesPartnerCommissionFreeze?.byProductId;
    const lines = items.map((item) => {
      const match = source.find((row) => row.variantId && row.variantId === item.productVariantId)
        || source.find((row) => row.productName === item.productName);
      const frozen = match ? freeze?.[match.productId] : undefined;
      return {
        orderItemId: item.id,
        lineTotalIrr: Number(item.totalPrice || 0),
        percent: frozen?.percent ?? match?.commissionPercent ?? 0,
        ruleId: frozen?.ruleId ?? match?.ruleId ?? null,
        ruleVersion: frozen?.ruleVersion ?? match?.ruleVersion ?? 1,
      };
    });
    const computed = snapshotLineCommissions({
      lines,
      orderDiscountIrr: Number(order.discount || 0),
      walletAppliedIrr: Number(order.walletApplied || 0),
    });
    for (const snap of computed) {
      if (have.has(snap.orderItemId)) continue;
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
    const existing = await this.snapshots.find({ where: { orderId: order.id } });
    const have = new Set(existing.map((row) => row.orderItemId));
    const clicked = new Set(order.salesPartnerProductIds || []);
    if (!clicked.size) return;
    const freeze = order.salesPartnerCommissionFreeze?.byProductId ?? null;
    const variantIds = [...new Set(items.map((item) => item.productVariantId))];
    const variants = variantIds.length
      ? await this.variants.find({ where: { id: In(variantIds) } })
      : [];
    const productByVariant = new Map(variants.map((row) => [row.id, row.productId]));
    const clickedLines = new Map<string, { percent: number; ruleId: string | null; ruleVersion: number }>();
    for (const item of items) {
      if (have.has(item.id)) continue;
      const productId = productByVariant.get(item.productVariantId);
      if (!productId || !clicked.has(productId)) continue;
      const frozen = freeze?.[productId];
      if (frozen) {
        clickedLines.set(item.id, {
          percent: frozen.percent,
          ruleId: frozen.ruleId,
          ruleVersion: frozen.ruleVersion,
        });
        continue;
      }
      if (freeze) continue;
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
    } catch (err) {
      if (isUniqueViolation(err)) return 0;
      throw err;
    }
  }
}

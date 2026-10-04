import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
  advanceLedgerCursor,
  availableAtFromDelivery,
  canAutoRelease,
  earnedIdempotencyKey,
  partnerTotalsFromBucketRows,
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
    return this.syncPage('converted-drafts', limit, async (cursor) => {
      const qb = this.drafts.createQueryBuilder('d')
        .where(`d.status = :status`, { status: 'CONVERTED_TO_ORDER' })
        .orderBy('d.updatedAt', 'ASC')
        .addOrderBy('d.id', 'ASC')
        .take(limit);
      if (cursor.cursorAt && cursor.cursorId) {
        qb.andWhere(`(d.updatedAt, d.id) > (:at, :id)`, { at: cursor.cursorAt, id: cursor.cursorId });
      }
      const drafts = await qb.getMany();
      let n = 0;
      for (const draft of drafts) {
        if (!draft.convertedOrderId) continue;
        n += await this.syncDraft(draft);
      }
      return { rows: drafts.map((row) => ({ id: row.id, updatedAt: row.updatedAt })), writes: n };
    });
  }

  async syncLinkOrders(limit = 50) {
    return this.syncPage('link-orders', limit, async (cursor) => {
      const qb = this.orders.createQueryBuilder('o')
        .where(`o.salesSource = :src`, { src: 'SALES_PARTNER' })
        .andWhere(`o.salesPartnerSubmissionId IS NULL`)
        .orderBy('o.updatedAt', 'ASC')
        .addOrderBy('o.id', 'ASC')
        .take(limit);
      if (cursor.cursorAt && cursor.cursorId) {
        qb.andWhere(`(o.updatedAt, o.id) > (:at, :id)`, { at: cursor.cursorAt, id: cursor.cursorId });
      }
      const orders = await qb.getMany();
      let n = 0;
      for (const order of orders) {
        if (!order.salesPartnerId) continue;
        const items = await this.orderItems.find({ where: { orderId: order.id } });
        await this.ensureLinkSnapshots(order, items);
        n += await this.applyOrderLedger(order.salesPartnerId, order);
      }
      return { rows: orders.map((row) => ({ id: row.id, updatedAt: row.updatedAt })), writes: n };
    });
  }

  private async syncPage(
    name: string,
    limit: number,
    run: (cursor: { cursorAt: Date | null; cursorId: string | null }) => Promise<{ rows: { id: string; updatedAt: Date }[]; writes: number }>,
  ) {
    const runner = this.entries.manager.connection.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const lock = await runner.query(
        `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS ok`,
        [`sales-partner-ledger-sync:${name}`],
      );
      if (!lock[0]?.ok) {
        await runner.rollbackTransaction();
        return 0;
      }
      const cursor = await this.readCursor(name);
      const result = await run(cursor);
      const next = advanceLedgerCursor(result.rows, limit);
      await this.writeCursor(name, next.cursorAt, next.cursorId, null);
      await runner.commitTransaction();
      return result.writes;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await runner.rollbackTransaction().catch(() => undefined);
      const cursor = await this.readCursor(name).catch(() => ({ cursorAt: null, cursorId: null }));
      await this.writeCursor(name, cursor.cursorAt, cursor.cursorId, message.slice(0, 240)).catch(() => undefined);
      throw err;
    } finally {
      await runner.release();
    }
  }

  private async readCursor(name: string) {
    const rows: Array<{ cursorAt: Date | null; cursorId: string | null }> = await this.entries.query(
      `SELECT "cursorAt", "cursorId" FROM sales_partner_ledger_cursors WHERE name = $1`,
      [name],
    );
    return { cursorAt: rows[0]?.cursorAt ?? null, cursorId: rows[0]?.cursorId ?? null };
  }

  private async writeCursor(name: string, cursorAt: Date | null, cursorId: string | null, lastError: string | null) {
    await this.entries.query(
      `INSERT INTO sales_partner_ledger_cursors (name, "cursorAt", "cursorId", "updatedAt", "lastError")
       VALUES ($1, $2, $3, now(), $4)
       ON CONFLICT (name) DO UPDATE SET "cursorAt" = EXCLUDED."cursorAt", "cursorId" = EXCLUDED."cursorId", "updatedAt" = now(), "lastError" = EXCLUDED."lastError"`,
      [name, cursorAt, cursorId, lastError],
    );
  }

  async balances(salesPartnerId: string, page = { take: 50, skip: 0 }) {
    const now = new Date();
    const totals = await this.sumBalances(salesPartnerId, now);
    const take = Math.min(Math.max(page.take, 1), 100);
    const skip = Math.max(page.skip, 0);
    const [rows, total] = await this.entries.findAndCount({
      where: { salesPartnerId },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
    return {
      ...totals,
      total,
      entries: rows.map((row) => this.toPublicEntry(row)),
    };
  }

  /** Full-ledger rollup. Not a sample. */
  async programBalances() {
    const now = new Date();
    const [totals, byPartner] = await Promise.all([this.sumBalances(null, now), this.balancesByPartner(now)]);
    return { ...totals, byPartner, sampleSize: null as null, complete: true };
  }

  /** One grouped query. Each partner is clamped the same way as the program card. */
  private async balancesByPartner(now: Date) {
    const rows: Array<{ salesPartnerId: string; bucket: string; amount: string }> = await this.entries.query(
      `SELECT "salesPartnerId",
         CASE
           WHEN "entryType" = 'PAYOUT' THEN 'paid'
           WHEN "entryType" = 'COMMISSION_REVERSAL' THEN 'reversed'
           ELSE 'skip'
         END AS bucket,
         COALESCE(SUM(ABS("amountIrr")), 0)::text AS amount
       FROM sales_commission_ledger_entries
       WHERE "entryType" IN ('PAYOUT', 'COMMISSION_REVERSAL')
       GROUP BY "salesPartnerId", 2
       UNION ALL
       SELECT "salesPartnerId",
         CASE
           WHEN "entryType" = 'COMMISSION_REVERSAL' AND bucket = 'held' THEN 'held'
           WHEN "entryType" IN ('COMMISSION_EARNED', 'MANUAL_ADJUSTMENT', 'PAYOUT_REVERSAL')
             AND ("availableAt" IS NULL OR "availableAt" > $1::timestamptz) THEN 'held'
           ELSE 'available'
         END AS bucket,
         COALESCE(SUM("amountIrr"), 0)::text AS amount
       FROM sales_commission_ledger_entries
       WHERE "payoutId" IS NULL AND "entryType" <> 'PAYOUT'
       GROUP BY "salesPartnerId", 2`,
      [now.toISOString()],
    );
    return partnerTotalsFromBucketRows(
      rows.map((row) => ({
        salesPartnerId: row.salesPartnerId,
        bucket: row.bucket,
        amountIrr: Math.trunc(Number(row.amount) || 0),
      })),
    );
  }

  private async sumBalances(salesPartnerId: string | null, now: Date) {
    const partnerClause = salesPartnerId ? 'AND "salesPartnerId" = $2' : '';
    const params: unknown[] = [now.toISOString()];
    if (salesPartnerId) params.push(salesPartnerId);
    const rows: Array<{ bucket: string; amount: string }> = await this.entries.query(
      `SELECT
         CASE
           WHEN "entryType" = 'PAYOUT' THEN 'paid'
           WHEN "entryType" = 'COMMISSION_REVERSAL' THEN 'reversed'
           ELSE 'skip'
         END AS bucket,
         COALESCE(SUM(ABS("amountIrr")), 0)::text AS amount
       FROM sales_commission_ledger_entries
       WHERE "entryType" IN ('PAYOUT', 'COMMISSION_REVERSAL') ${partnerClause}
       GROUP BY 1
       UNION ALL
       SELECT
         CASE
           WHEN "entryType" = 'COMMISSION_REVERSAL' AND bucket = 'held' THEN 'held'
           WHEN "entryType" IN ('COMMISSION_EARNED', 'MANUAL_ADJUSTMENT', 'PAYOUT_REVERSAL')
             AND ("availableAt" IS NULL OR "availableAt" > $1::timestamptz) THEN 'held'
           ELSE 'available'
         END AS bucket,
         COALESCE(SUM("amountIrr"), 0)::text AS amount
       FROM sales_commission_ledger_entries
       WHERE "payoutId" IS NULL AND "entryType" <> 'PAYOUT' ${partnerClause}
       GROUP BY 1`,
      params,
    );
    let held = 0;
    let available = 0;
    let paid = 0;
    let reversed = 0;
    for (const row of rows) {
      const amount = Math.trunc(Number(row.amount) || 0);
      if (row.bucket === 'held') held += amount;
      else if (row.bucket === 'available') available += amount;
      else if (row.bucket === 'paid') paid += amount;
      else if (row.bucket === 'reversed') reversed += amount;
    }
    let debt = 0;
    if (available < 0) {
      debt += -available;
      available = 0;
    }
    if (held < 0) {
      debt += -held;
      held = 0;
    }
    return { estimated: 0, held, available, paid, reversed, debt };
  }

  private toPublicEntry(row: SalesCommissionLedgerEntryEntity) {
    return {
      id: row.id,
      orderId: row.orderId,
      amountIrr: Number(row.amountIrr),
      entryType: row.entryType,
      availableAt: row.availableAt,
      reasonCode: row.reasonCode,
      bucket: row.bucket,
      createdAt: row.createdAt,
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
    await this.releaseHeldReversals(order.id, new Date());
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
    }) ?? await this.entries.findOne({
      where: { orderId: input.orderId, orderItemId: input.orderItemId, entryType: 'COMMISSION_EARNED' },
    });
    if (!earned) return 0;
    const prior = await this.entries.find({
      where: { orderId: input.orderId, orderItemId: input.orderItemId, entryType: 'COMMISSION_REVERSAL' },
    });
    const already = prior.reduce((sum, row) => sum + Math.abs(Number(row.amountIrr)), 0);
    const remaining = remainingReversalIrr(input.earnedIrr, already);
    if (remaining <= 0) return 0;
    const bucket = !earned.availableAt || earned.availableAt.getTime() > Date.now() ? 'held' : 'available';
    return this.insertIgnore({
      salesPartnerId: input.salesPartnerId,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      amountIrr: -remaining,
      entryType: 'COMMISSION_REVERSAL',
      availableAt: new Date(),
      bucket,
      idempotencyKey: reversalIdempotencyKey(input.orderId, input.orderItemId, input.reason),
      reasonCode: input.reason.slice(0, 64),
    });
  }

  private async ensureSnapshots(draft: SalesPartnerOrderDraftEntity, order: OrderEntity, items: OrderItemEntity[]) {
    const existing = await this.snapshots.find({ where: { orderId: draft.convertedOrderId! } });
    const have = new Set(existing.map((row) => row.orderItemId));
    const missingItems = items.filter((item) => !have.has(item.id));
    if (!missingItems.length) return;
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
    await this.insertSnapshots(computed.filter((snap) => !have.has(snap.orderItemId)).map((snap) => {
      const meta = lines.find((line) => line.orderItemId === snap.orderItemId);
      return {
        orderId: draft.convertedOrderId!,
        orderItemId: snap.orderItemId,
        salesPartnerId: draft.salesPartnerId,
        ruleId: meta?.ruleId ?? null,
        ruleVersion: meta?.ruleVersion ?? 1,
        percent: snap.percent,
        eligibleNetIrr: String(snap.eligibleNetIrr),
        commissionIrr: String(snap.commissionIrr),
      };
    }));
  }

  private async ensureLinkSnapshots(order: OrderEntity, items: OrderItemEntity[]) {
    if (!order.salesPartnerId) return;
    const existing = await this.snapshots.find({ where: { orderId: order.id } });
    const have = new Set(existing.map((row) => row.orderItemId));
    const missingItems = items.filter((item) => !have.has(item.id));
    if (!missingItems.length) return;
    const clicked = new Set(order.salesPartnerProductIds || []);
    if (!clicked.size) return;
    const variantIds = [...new Set(missingItems.map((item) => item.productVariantId))];
    const variants = variantIds.length
      ? await this.variants.find({ where: { id: In(variantIds) } })
      : [];
    const productByVariant = new Map(variants.map((row) => [row.id, row.productId]));
    const clickedLines = new Map<string, { percent: number; ruleId: string | null; ruleVersion: number }>();
    const frozenAt = order.createdAt ?? new Date();
    for (const item of missingItems) {
      const productId = productByVariant.get(item.productVariantId);
      if (!productId || !clicked.has(productId)) continue;
      const lineTotal = Math.max(0, Math.floor(Number(item.totalPrice || 0)));
      const preview = await this.catalog.previewAt(order.salesPartnerId, productId, lineTotal, frozenAt);
      clickedLines.set(item.id, {
        percent: preview.percent,
        ruleId: preview.ruleId,
        ruleVersion: preview.ruleVersion,
      });
    }
    if (!clickedLines.size) return;
    const lines = items.map((item) => {
      const meta = clickedLines.get(item.id);
      const prior = existing.find((row) => row.orderItemId === item.id);
      return {
        orderItemId: item.id,
        lineTotalIrr: Math.max(0, Math.floor(Number(item.totalPrice || 0))),
        percent: prior ? prior.percent : (meta?.percent ?? 0),
      };
    });
    const computed = snapshotLineCommissions({
      lines,
      orderDiscountIrr: Number(order.discount || 0),
      walletAppliedIrr: Number(order.walletApplied || 0),
    });
    await this.insertSnapshots(computed.flatMap((snap) => {
      if (have.has(snap.orderItemId)) return [];
      const meta = clickedLines.get(snap.orderItemId);
      if (!meta) return [];
      return [{
        orderId: order.id,
        orderItemId: snap.orderItemId,
        salesPartnerId: order.salesPartnerId!,
        ruleId: meta.ruleId,
        ruleVersion: meta.ruleVersion,
        percent: snap.percent,
        eligibleNetIrr: String(snap.eligibleNetIrr),
        commissionIrr: String(snap.commissionIrr),
      }];
    }));
  }

  private async insertSnapshots(rows: Array<{
    orderId: string;
    orderItemId: string;
    salesPartnerId: string;
    ruleId: string | null;
    ruleVersion: number;
    percent: number;
    eligibleNetIrr: string;
    commissionIrr: string;
  }>) {
    for (const row of rows) {
      await this.snapshots.query(
        `INSERT INTO sales_commission_snapshots
          ("orderId", "orderItemId", "salesPartnerId", "ruleId", "ruleVersion", percent, "eligibleNetIrr", "commissionIrr")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ("orderItemId") DO NOTHING`,
        [row.orderId, row.orderItemId, row.salesPartnerId, row.ruleId, row.ruleVersion, row.percent, row.eligibleNetIrr, row.commissionIrr],
      );
    }
  }

  private async releaseHeldReversals(orderId: string, now: Date) {
    await this.entries.query(
      `UPDATE sales_commission_ledger_entries AS rev
       SET bucket = 'available'
       FROM sales_commission_ledger_entries AS earned
       WHERE rev."orderId" = $1
         AND rev."entryType" = 'COMMISSION_REVERSAL'
         AND rev.bucket = 'held'
         AND rev."payoutId" IS NULL
         AND earned."orderId" = rev."orderId"
         AND earned."orderItemId" = rev."orderItemId"
         AND earned."entryType" = 'COMMISSION_EARNED'
         AND earned."availableAt" IS NOT NULL
         AND earned."availableAt" <= $2`,
      [orderId, now],
    );
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
    bucket?: string | null;
  }) {
    const found = await this.entries.findOne({ where: { idempotencyKey: row.idempotencyKey } })
      ?? (row.entryType === 'COMMISSION_EARNED'
        ? await this.entries.findOne({
          where: { orderId: row.orderId, orderItemId: row.orderItemId, entryType: 'COMMISSION_EARNED' },
        })
        : null);
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
        bucket: row.bucket ?? null,
        createdBy: null,
      }));
      return 1;
    } catch (err: unknown) {
      const code = (err as { code?: string; driverError?: { code?: string } })?.code
        || (err as { driverError?: { code?: string } })?.driverError?.code;
      if (code === '23505') return 0;
      this.logger.error(`ledger insert failed ${row.idempotencyKey}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }
}

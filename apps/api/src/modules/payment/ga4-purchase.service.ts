import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEventLogEntity } from './entities/analytics-event-log.entity';
import { OrderEntity } from '../order/entities/order.entity';
import {
  buildPurchaseBodyChecked,
  postPurchase,
  resolveGa4MpConfig,
  sanitizeGaClientId,
  sanitizeGaSessionId,
  type Ga4BuildResult,
  type Ga4Channel,
} from './ga4-mp';
import {
  batchClaimSql,
  clientFallbackSql,
  expireSweepSql,
  finishSql,
  ga4LedgerTable,
  inlineClaimSql,
  insertPendingSql,
  ledgerUpdateForOutcome,
  ownershipForStatus,
  rowsOf,
  selectByTransactionSql,
  type Ga4LedgerStatus,
  type SqlQuery,
} from './ga4-purchase.sql';

/** Inline budget on /payments/verify; anything slower is left to the retry job. */
const INLINE_TIMEOUT_MS = 1500;
const RETRY_TIMEOUT_MS = 4000;
/** Rows are sent one by one; RETRY_BATCH × RETRY_TIMEOUT_MS must stay well under GA4_LEASE_SECONDS. */
const RETRY_BATCH = 10;
const CHANNELS: Ga4Channel[] = ['RETAIL', 'WHOLESALE'];
const T = ga4LedgerTable();

export type Ga4PurchaseResult = {
  /** True when the server owns GA4 purchase for this order (client must not send). */
  serverOwned: boolean;
  status: Ga4LedgerStatus | 'DISABLED';
};

type ClaimedRow = {
  id: string;
  transactionId: string;
  channel: string;
  orderId: string | null;
  gaClientId: string | null;
  gaSessionId: string | null;
  attempts: number;
  eventAt: Date | string;
};

/**
 * Exactly-once GA4 purchase via Measurement Protocol after a verified payment.
 *
 * Ownership is decided once, atomically, per transaction:
 * - with a GA client id and a locally valid payload the server claims it
 *   (PENDING → SENDING + lease) and stays the only sender; transient failures go
 *   to FAILED with `nextAttemptAt` and the per-minute job retries them;
 * - without a client id, or when the payload fails validation before any POST,
 *   the row moves PENDING → CLIENT_FALLBACK and the server never sends for it.
 * SENT means transport acceptance (2xx) only: MP answers 2xx even for malformed
 * payloads, which is why nothing is POSTed unless `validatePurchaseBody` passes.
 * Never throws into the payment flow.
 */
@Injectable()
export class Ga4PurchaseService {
  private readonly logger = new Logger(Ga4PurchaseService.name);

  constructor(
    @InjectRepository(AnalyticsEventLogEntity)
    private readonly logRepo: Repository<AnalyticsEventLogEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
  ) {}

  async sendPurchaseOnce(input: {
    orderId: string | null | undefined;
    paymentId: string;
    channel: Ga4Channel;
    gaClientId?: string;
    gaSessionId?: string;
  }): Promise<Ga4PurchaseResult> {
    let transactionId = '';
    try {
      const cfg = resolveGa4MpConfig(input.channel);
      if (!cfg.enabled || !input.orderId) return { serverOwned: false, status: 'DISABLED' };

      const order = await this.orderRepo.findOne({
        where: { id: input.orderId },
        relations: ['items'],
      });
      if (!order?.orderNumber || order.voidedAt) return { serverOwned: false, status: 'SKIPPED' };

      transactionId = String(order.orderNumber);
      const clientId = sanitizeGaClientId(input.gaClientId);
      const sessionId = sanitizeGaSessionId(input.gaSessionId);

      await this.run(
        insertPendingSql(T, {
          transactionId,
          channel: input.channel,
          measurementId: cfg.measurementId,
          orderId: order.id,
          paymentId: input.paymentId,
          valueIrr: Number(order.total) || 0,
        }),
      );
      const [row] = await this.run<{ id: string; status: string; eventAt: Date | string }>(
        selectByTransactionSql(T, transactionId),
      );
      if (!row) return { serverOwned: false, status: 'SKIPPED' };
      if (row.status !== 'PENDING') return ownershipForStatus(row.status);

      if (!clientId) return this.handOffToClient(row.id, 'missing_client_id', transactionId, input.channel);

      const built = this.buildBody(order, transactionId, clientId, sessionId, row.eventAt);
      if (!built.body) {
        return this.handOffToClient(row.id, `schema_invalid:${built.errors[0]}`, transactionId, input.channel);
      }

      const [claim] = await this.run<{ id: string; attempts: number }>(
        inlineClaimSql(T, row.id, clientId, sessionId || null),
      );
      if (!claim) return ownershipForStatus(await this.freshStatus(transactionId));

      const outcome = await postPurchase(cfg, built.body, { transactionId, timeoutMs: INLINE_TIMEOUT_MS });
      const status = await this.finish(claim.id, Number(claim.attempts), outcome, transactionId, input.channel);
      return ownershipForStatus(status);
    } catch {
      this.logger.warn(
        JSON.stringify({ event: 'ga4.purchase.error', transactionId, channel: input.channel, code: 'internal' }),
      );
      return this.ownershipAfterError(transactionId);
    }
  }

  /** Expires stale rows, then claims due FAILED / lease-expired SENDING rows and sends each once. */
  @Cron(CronExpression.EVERY_MINUTE)
  async retryFailed(): Promise<void> {
    const channels = CHANNELS.filter((c) => resolveGa4MpConfig(c).enabled);
    if (!channels.length) return;
    try {
      const expired = await this.run<{ transactionId: string; channel: string; lastError: string }>(
        expireSweepSql(T),
      );
      for (const r of expired) {
        this.logger.warn(
          JSON.stringify({
            event: 'ga4.purchase.expired',
            transactionId: r.transactionId,
            channel: r.channel,
            status: 'EXPIRED',
            code: r.lastError,
          }),
        );
      }

      const rows = await this.run<ClaimedRow>(batchClaimSql(T, RETRY_BATCH, channels));
      for (const row of rows) await this.retryOne(row);
    } catch {
      this.logger.warn(JSON.stringify({ event: 'ga4.purchase.retry_error', code: 'internal' }));
    }
  }

  private async retryOne(row: ClaimedRow): Promise<void> {
    const channel = row.channel as Ga4Channel;
    const attempts = Number(row.attempts);
    try {
      const cfg = resolveGa4MpConfig(channel);
      const order = row.orderId
        ? await this.orderRepo.findOne({ where: { id: row.orderId }, relations: ['items'] })
        : null;
      if (!order || order.voidedAt || !row.gaClientId) {
        await this.finish(row.id, attempts, { kind: 'invalid', code: 'order_unavailable' }, row.transactionId, channel);
        return;
      }
      const built = this.buildBody(order, row.transactionId, row.gaClientId, row.gaSessionId ?? '', row.eventAt);
      if (!built.body) {
        const code = `schema_invalid:${built.errors[0]}`;
        await this.finish(row.id, attempts, { kind: 'invalid', code }, row.transactionId, channel);
        return;
      }
      const outcome = await postPurchase(cfg, built.body, {
        transactionId: row.transactionId,
        timeoutMs: RETRY_TIMEOUT_MS,
      });
      await this.finish(row.id, attempts, outcome, row.transactionId, channel);
    } catch {
      /* lease expiry hands the row to a later run */
      this.logger.warn(
        JSON.stringify({ event: 'ga4.purchase.retry_error', transactionId: row.transactionId, channel, code: 'internal' }),
      );
    }
  }

  private buildBody(
    order: OrderEntity,
    transactionId: string,
    clientId: string,
    sessionId: string,
    eventAt: Date | string,
  ): Ga4BuildResult {
    return buildPurchaseBodyChecked({
      clientId,
      sessionId,
      transactionId,
      eventTimeMs: new Date(eventAt).getTime(),
      valueIrr: Number(order.total) || 0,
      shippingIrr: Number(order.shippingFee) || 0,
      affiliation: order.salesPartnerId ? 'sales_partner' : order.affiliateId ? 'affiliate' : undefined,
      items: (order.items ?? []).map((it) => ({
        sku: it.sku,
        productName: it.productName,
        color: it.color,
        size: it.size,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
      })),
    });
  }

  private async handOffToClient(
    id: string,
    reason: string,
    transactionId: string,
    channel: Ga4Channel,
  ): Promise<Ga4PurchaseResult> {
    const [moved] = await this.run<{ id: string }>(clientFallbackSql(T, id, reason));
    if (!moved) return ownershipForStatus(await this.freshStatus(transactionId));
    this.logger.log(
      JSON.stringify({
        event: 'ga4.purchase.client_fallback',
        transactionId,
        channel,
        status: 'CLIENT_FALLBACK',
        code: reason,
      }),
    );
    return ownershipForStatus('CLIENT_FALLBACK');
  }

  /**
   * Fenced transition out of SENDING. `transport_accepted` (2xx) → SENT; it is
   * not proof of payload validity. A lost fence means another worker took over.
   */
  private async finish(
    id: string,
    attempts: number,
    outcome: Parameters<typeof ledgerUpdateForOutcome>[0],
    transactionId: string,
    channel: string,
  ): Promise<Ga4LedgerStatus> {
    const update = ledgerUpdateForOutcome(outcome, attempts);
    const event =
      update.status === 'SENT'
        ? 'ga4.purchase.transport_accepted'
        : update.status === 'FAILED'
          ? 'ga4.purchase.retry_scheduled'
          : update.status === 'INVALID'
            ? 'ga4.purchase.invalid'
            : 'ga4.purchase.expired';
    let moved = false;
    try {
      moved = (await this.run<{ id: string }>(finishSql(T, id, attempts, update))).length > 0;
    } catch {
      /* SENDING stays leased; the job reclaims it after lease expiry */
    }
    if (!moved) {
      this.logger.error(
        JSON.stringify({ event: 'ga4.purchase.finish_not_applied', transactionId, channel, status: update.status }),
      );
      return 'SENDING';
    }
    const line = JSON.stringify({ event, transactionId, channel, status: update.status, code: update.lastError });
    if (update.status === 'SENT') this.logger.log(line);
    else this.logger.warn(line);
    return update.status;
  }

  private async run<R>(q: SqlQuery): Promise<R[]> {
    return rowsOf<R>(await this.logRepo.query(q.sql, q.params));
  }

  private async freshStatus(transactionId: string): Promise<string> {
    const [row] = await this.run<{ status: string }>(selectByTransactionSql(T, transactionId));
    return row?.status ?? 'SKIPPED';
  }

  /**
   * On an unexpected error, report whatever the ledger says. A PENDING row is handed to the
   * client first, or a later verify could claim it and send a second purchase.
   */
  private async ownershipAfterError(transactionId: string): Promise<Ga4PurchaseResult> {
    if (!transactionId) return { serverOwned: false, status: 'SKIPPED' };
    try {
      const [row] = await this.run<{ id: string; status: string }>(selectByTransactionSql(T, transactionId));
      if (row?.status === 'PENDING') {
        const [moved] = await this.run<{ id: string }>(clientFallbackSql(T, row.id, 'internal_error'));
        if (moved) return ownershipForStatus('CLIENT_FALLBACK');
      }
      return ownershipForStatus(await this.freshStatus(transactionId));
    } catch {
      return { serverOwned: false, status: 'SKIPPED' };
    }
  }
}

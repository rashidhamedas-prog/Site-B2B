import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEventLogEntity } from './entities/analytics-event-log.entity';
import { OrderEntity } from '../order/entities/order.entity';
import {
  buildPurchaseBody,
  mpCollectUrl,
  resolveGa4MpConfig,
  sanitizeGaClientId,
  sanitizeGaSessionId,
  type Ga4Channel,
  type Ga4MpBody,
  type Ga4MpConfig,
} from './ga4-mp';

const MAX_ATTEMPTS = 5;
/** Inline budget on /payments/verify; anything slower is left to the retry job. */
const INLINE_TIMEOUT_MS = 1500;
const RETRY_TIMEOUT_MS = 4000;
const RETRY_BATCH = 20;
/** Measurement Protocol cannot usefully deliver a purchase older than this. */
const RETRY_MAX_AGE_HOURS = 72;

/** Statuses in which the server (not the browser) is responsible for the purchase. */
const SERVER_OWNED = new Set(['SENDING', 'SENT', 'FAILED']);

export type Ga4PurchaseResult = {
  /** True when the server owns GA4 purchase for this order (client must not send). */
  serverOwned: boolean;
  status: 'SENT' | 'SENDING' | 'FAILED' | 'SKIPPED' | 'DISABLED';
};

/**
 * Exactly-once GA4 purchase via Measurement Protocol after a verified payment.
 *
 * Ownership is decided once, atomically, per transaction:
 * - with a GA client id the server claims it (PENDING → SENDING) and stays the
 *   only sender; failures go to FAILED and the cron job retries them;
 * - without one the row moves PENDING → CLIENT_FALLBACK and the server never
 *   sends for it, even if a later verify carries a client id.
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
    try {
      const cfg = resolveGa4MpConfig(input.channel);
      if (!cfg.enabled || !input.orderId) return { serverOwned: false, status: 'DISABLED' };

      const order = await this.orderRepo.findOne({
        where: { id: input.orderId },
        relations: ['items'],
      });
      if (!order?.orderNumber || order.voidedAt) return { serverOwned: false, status: 'SKIPPED' };

      const transactionId = String(order.orderNumber);
      const clientId = sanitizeGaClientId(input.gaClientId);
      const sessionId = sanitizeGaSessionId(input.gaSessionId);

      await this.logRepo
        .createQueryBuilder()
        .insert()
        .into(AnalyticsEventLogEntity)
        .values({
          eventName: 'purchase',
          transactionId,
          channel: input.channel,
          measurementId: cfg.measurementId,
          orderId: order.id,
          paymentId: input.paymentId,
          valueIrr: Number(order.total) || 0,
          status: 'PENDING',
        })
        .orIgnore()
        .execute();

      const row = await this.logRepo.findOne({
        where: { eventName: 'purchase', transactionId },
        select: ['id', 'status'],
      });
      if (!row) return { serverOwned: false, status: 'SKIPPED' };
      if (row.status !== 'PENDING') return this.ownership(row.status);

      if (!clientId) {
        const handoff = await this.logRepo
          .createQueryBuilder()
          .update(AnalyticsEventLogEntity)
          .set({ status: 'CLIENT_FALLBACK', lastError: 'missing_client_id' })
          .where('id = :id AND status = :pending', { id: row.id, pending: 'PENDING' })
          .execute();
        if (handoff.affected) return { serverOwned: false, status: 'SKIPPED' };
        return this.ownership(await this.freshStatus(row.id));
      }

      const claim = await this.logRepo
        .createQueryBuilder()
        .update(AnalyticsEventLogEntity)
        .set({
          status: 'SENDING',
          attempts: () => '"attempts" + 1',
          gaClientId: clientId,
          gaSessionId: sessionId || null,
        })
        .where('id = :id AND status = :pending', { id: row.id, pending: 'PENDING' })
        .execute();
      if (!claim.affected) return this.ownership(await this.freshStatus(row.id));

      const body = this.buildBody(order, transactionId, clientId, sessionId);
      if (!body) {
        await this.logRepo.update(row.id, { status: 'CLIENT_FALLBACK', lastError: 'invalid_payload' });
        return { serverOwned: false, status: 'SKIPPED' };
      }

      const lastError = await this.post(cfg, body, INLINE_TIMEOUT_MS);
      if (!lastError) {
        await this.markSent(row.id, transactionId, input.channel);
        return { serverOwned: true, status: 'SENT' };
      }
      await this.markFailed(row.id, lastError);
      return { serverOwned: true, status: 'FAILED' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(JSON.stringify({ event: 'ga4.purchase.error', message: message.slice(0, 200) }));
      return this.ownershipAfterError(input.orderId);
    }
  }

  /** Retries server-owned purchases whose inline send failed or whose sender crashed. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryFailed(): Promise<void> {
    try {
      const rows = await this.logRepo
        .createQueryBuilder('l')
        .select(['l.id', 'l.transactionId', 'l.channel', 'l.orderId', 'l.gaClientId', 'l.gaSessionId'])
        .where('l.eventName = :name', { name: 'purchase' })
        .andWhere('l.attempts < :max', { max: MAX_ATTEMPTS })
        .andWhere('l.gaClientId IS NOT NULL')
        .andWhere(
          `(l.status = 'FAILED' OR (l.status = 'SENDING' AND l."updatedAt" < now() - interval '5 minutes'))`,
        )
        .andWhere(`l."createdAt" > now() - interval '${RETRY_MAX_AGE_HOURS} hours'`)
        .orderBy('l.createdAt', 'ASC')
        .limit(RETRY_BATCH)
        .getMany();

      for (const row of rows) {
        const cfg = resolveGa4MpConfig(row.channel as Ga4Channel);
        if (!cfg.enabled || !row.orderId || !row.gaClientId) continue;

        const claim = await this.logRepo
          .createQueryBuilder()
          .update(AnalyticsEventLogEntity)
          .set({ status: 'SENDING', attempts: () => '"attempts" + 1' })
          .where('id = :id AND attempts < :max', { id: row.id, max: MAX_ATTEMPTS })
          .andWhere(
            `(status = 'FAILED' OR (status = 'SENDING' AND "updatedAt" < now() - interval '5 minutes'))`,
          )
          .execute();
        if (!claim.affected) continue;

        const order = await this.orderRepo.findOne({ where: { id: row.orderId }, relations: ['items'] });
        const body = order && !order.voidedAt
          ? this.buildBody(order, row.transactionId, row.gaClientId, row.gaSessionId ?? '')
          : null;
        if (!body) {
          await this.logRepo.update(row.id, { status: 'SKIPPED', lastError: 'invalid_payload' });
          continue;
        }
        const lastError = await this.post(cfg, body, RETRY_TIMEOUT_MS);
        if (!lastError) await this.markSent(row.id, row.transactionId, row.channel);
        else await this.markFailed(row.id, lastError);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(JSON.stringify({ event: 'ga4.purchase.retry_error', message: message.slice(0, 200) }));
    }
  }

  private buildBody(
    order: OrderEntity,
    transactionId: string,
    clientId: string,
    sessionId: string,
  ): Ga4MpBody | null {
    return buildPurchaseBody({
      clientId,
      sessionId,
      transactionId,
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

  /** One MP request. Returns '' on 2xx, otherwise a short error code (never the URL/secret). */
  private async post(cfg: Ga4MpConfig, body: Ga4MpBody, timeoutMs: number): Promise<string> {
    try {
      const res = await fetch(mpCollectUrl(cfg), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      await res.body?.cancel().catch(() => undefined);
      return res.status >= 200 && res.status < 300 ? '' : `http_${res.status}`;
    } catch (err: unknown) {
      return err instanceof Error ? err.name.slice(0, 60) : 'network_error';
    }
  }

  /** After a 2xx the purchase is delivered; a failed bookkeeping write must not hand it to the browser. */
  private async markSent(id: string, transactionId: string, channel: string): Promise<void> {
    try {
      await this.logRepo.update(id, { status: 'SENT', sentAt: new Date(), lastError: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        JSON.stringify({ event: 'ga4.purchase.mark_sent_failed', transactionId, message: message.slice(0, 200) }),
      );
      return;
    }
    this.logger.log(JSON.stringify({ event: 'ga4.purchase.sent', transactionId, channel }));
  }

  private async markFailed(id: string, lastError: string): Promise<void> {
    try {
      await this.logRepo.update(id, { status: 'FAILED', lastError });
    } catch {
      /* stale SENDING is reclaimed by the retry job */
    }
    this.logger.warn(JSON.stringify({ event: 'ga4.purchase.failed', id, lastError }));
  }

  private async freshStatus(id: string): Promise<string> {
    const fresh = await this.logRepo.findOne({ where: { id }, select: ['id', 'status'] });
    return fresh?.status ?? 'SKIPPED';
  }

  private ownership(status: string): Ga4PurchaseResult {
    if (status === 'SENT') return { serverOwned: true, status: 'SENT' };
    if (status === 'FAILED') return { serverOwned: true, status: 'FAILED' };
    if (SERVER_OWNED.has(status)) return { serverOwned: true, status: 'SENDING' };
    return { serverOwned: false, status: 'SKIPPED' };
  }

  /** On an unexpected error, report whatever the ledger says rather than guessing. */
  private async ownershipAfterError(orderId: string | null | undefined): Promise<Ga4PurchaseResult> {
    if (!orderId) return { serverOwned: false, status: 'FAILED' };
    try {
      const row = await this.logRepo.findOne({
        where: { orderId, eventName: 'purchase' },
        select: ['id', 'status'],
      });
      if (row && SERVER_OWNED.has(row.status)) return this.ownership(row.status);
    } catch {
      /* fall through */
    }
    return { serverOwned: false, status: 'FAILED' };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEventLogEntity } from './entities/analytics-event-log.entity';
import { OrderEntity } from '../order/entities/order.entity';
import {
  buildPurchaseBody,
  mpCollectUrl,
  resolveGa4MpConfig,
  sanitizeGaClientId,
  type Ga4Channel,
} from './ga4-mp';

const MAX_ATTEMPTS = 5;
const STALE_SENDING_MS = 5 * 60 * 1000;

export type Ga4PurchaseResult = {
  /** True when the server owns GA4 purchase for this order (client must not send). */
  serverOwned: boolean;
  status: 'SENT' | 'SENDING' | 'FAILED' | 'SKIPPED' | 'DISABLED';
};

/**
 * Exactly-once GA4 purchase via Measurement Protocol after a verified payment.
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
      if (!order?.orderNumber) return { serverOwned: false, status: 'SKIPPED' };
      if (order.voidedAt) return { serverOwned: false, status: 'SKIPPED' };

      const transactionId = String(order.orderNumber);
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

      const row = await this.logRepo.findOne({ where: { eventName: 'purchase', transactionId } });
      if (!row) return { serverOwned: false, status: 'SKIPPED' };
      if (row.status === 'SENT') return { serverOwned: true, status: 'SENT' };

      const clientId = sanitizeGaClientId(input.gaClientId);
      if (!clientId) {
        // Without client_id GA4 MP cannot attribute; let the browser send instead.
        return { serverOwned: false, status: 'SKIPPED' };
      }

      const staleBefore = new Date(Date.now() - STALE_SENDING_MS);
      const claim = await this.logRepo
        .createQueryBuilder()
        .update(AnalyticsEventLogEntity)
        .set({ status: 'SENDING', attempts: () => '"attempts" + 1' })
        .where('id = :id', { id: row.id })
        .andWhere('attempts < :max', { max: MAX_ATTEMPTS })
        .andWhere(
          `(status = 'PENDING' OR (status = 'SENDING' AND "updatedAt" < :stale))`,
          { stale: staleBefore },
        )
        .execute();
      if (!claim.affected) {
        // SENDING by another request → server owns it. CLIENT_FALLBACK/SKIPPED → browser owns it.
        const owned = row.status === 'SENDING' || row.status === 'SENT';
        return { serverOwned: owned, status: owned ? 'SENDING' : 'SKIPPED' };
      }

      const body = buildPurchaseBody({
        clientId,
        sessionId: input.gaSessionId,
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
      if (!body) {
        await this.logRepo.update(row.id, { status: 'SKIPPED', lastError: 'invalid_payload' });
        return { serverOwned: false, status: 'SKIPPED' };
      }

      // Controlled retry: two network attempts, then one-way handoff to the browser.
      let lastError = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(mpCollectUrl(cfg), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(4000),
          });
          if (res.status >= 200 && res.status < 300) {
            await this.logRepo.update(row.id, { status: 'SENT', sentAt: new Date(), lastError: null });
            this.logger.log(
              JSON.stringify({ event: 'ga4.purchase.sent', transactionId, channel: input.channel }),
            );
            return { serverOwned: true, status: 'SENT' };
          }
          lastError = `http_${res.status}`;
        } catch (err: unknown) {
          lastError = err instanceof Error ? err.message.slice(0, 200) : 'network_error';
        }
      }
      await this.logRepo.update(row.id, { status: 'CLIENT_FALLBACK', lastError });
      this.logger.warn(JSON.stringify({ event: 'ga4.purchase.client_fallback', transactionId, lastError }));
      return { serverOwned: false, status: 'FAILED' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(JSON.stringify({ event: 'ga4.purchase.error', message: message.slice(0, 200) }));
      try {
        if (input.orderId) {
          await this.logRepo
            .createQueryBuilder()
            .update(AnalyticsEventLogEntity)
            .set({ status: 'CLIENT_FALLBACK', lastError: message.slice(0, 500) })
            .where('"orderId" = :orderId AND "eventName" = :name AND status = :sending', {
              orderId: input.orderId,
              name: 'purchase',
              sending: 'SENDING',
            })
            .execute();
        }
      } catch {
        /* ignore */
      }
      return { serverOwned: false, status: 'FAILED' };
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../order/entities/order.entity';
import { SettingsService } from '../settings/settings.service';

export type ConversionPayload = {
  orderId: string;
  orderNumber?: string;
  amount: number; // IRR
  affiliateId?: string | null;
  status?: 'paid' | 'pending' | 'cancelled';
};

/**
 * Server-to-server conversion postbacks for Iranian affiliate networks.
 * Admin configures URL templates with placeholders:
 *   {click_id} {order_id} {order_number} {amount} {amount_toman} {status}
 */
@Injectable()
export class AffiliatePostbackService {
  private readonly logger = new Logger(AffiliatePostbackService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    private readonly settings: SettingsService,
  ) {}

  /** Detect network from encoded click id (`network|id`) or free-form id. */
  parseAffiliate(raw?: string | null): { network: string; clickId: string } | null {
    if (!raw?.trim()) return null;
    const v = raw.trim();
    const pipe = v.indexOf('|');
    if (pipe > 0) {
      return { network: v.slice(0, pipe).toLowerCase(), clickId: v.slice(pipe + 1) };
    }
    return { network: 'generic', clickId: v };
  }

  private fill(template: string, vars: Record<string, string>) {
    return template.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(vars[k] ?? ''));
  }

  async fireForOrder(orderId: string, status: ConversionPayload['status'] = 'paid') {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) return { skipped: true, reason: 'order_not_found' };

    // Once-guard for paid conversions: PaymentEntity.postbackFiredAt is preferred when
    // available, but AffiliateModule only registers OrderEntity and PaymentEntity has no
    // such column yet — use an atomic notes tag to avoid duplicate network postbacks.
    if (status === 'paid') {
      const tagPrefix = 'AFFILIATE_POSTBACK_PAID_AT=';
      if (String(order.notes || '').includes(tagPrefix)) {
        return { skipped: true, reason: 'already_fired' };
      }
      const tag = `${tagPrefix}${new Date().toISOString()}`;
      const claimed: Array<{ id: string }> = await this.orders.query(
        `UPDATE orders
         SET notes = CASE
           WHEN notes IS NULL OR notes = '' THEN $2
           ELSE notes || E'\\n' || $2
         END,
         "updatedAt" = NOW()
         WHERE id = $1::uuid
           AND (notes IS NULL OR position($3 in notes) = 0)
         RETURNING id`,
        [orderId, tag, tagPrefix],
      );
      if (!claimed?.length) {
        return { skipped: true, reason: 'already_fired' };
      }
    }

    return this.fire({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: Number(order.total) || 0,
      affiliateId: order.affiliateId,
      status,
    });
  }

  async fire(payload: ConversionPayload) {
    const marketing = await this.settings.marketing();
    const parsed = this.parseAffiliate(payload.affiliateId);
    const vars = {
      click_id: parsed?.clickId || '',
      order_id: payload.orderId,
      order_number: payload.orderNumber || '',
      amount: String(payload.amount),
      amount_toman: String(Math.round(payload.amount / 10)),
      status: payload.status || 'paid',
    };

    const urls: Array<{ network: string; url: string }> = [];

    const pick = (network: string, url?: string) => {
      if (!url?.trim()) return;
      if (parsed && parsed.network !== 'generic' && parsed.network !== network) return;
      // Always fire network-specific URL when click matches OR when no click but URL is "broadcast" for paid
      if (parsed?.network === network || (!parsed && marketing.broadcastPostbacks)) {
        urls.push({ network, url: this.fill(url.trim(), vars) });
      } else if (parsed?.network === 'generic' && network === 'generic') {
        urls.push({ network, url: this.fill(url.trim(), vars) });
      }
    };

    pick('yektanet', marketing.yektanetPostbackUrl);
    pick('affer', marketing.afferPostbackUrl);
    pick('afsona', marketing.afsonaPostbackUrl);
    pick('takhfifan', marketing.takhfifanPostbackUrl);
    pick('generic', marketing.postbackUrl);

    // If we have a click id but no network-specific URL matched, still try generic.
    if (parsed && urls.length === 0 && marketing.postbackUrl?.trim()) {
      urls.push({ network: 'generic', url: this.fill(marketing.postbackUrl.trim(), vars) });
    }

    // Affiliate networks usually need a click id; skip empty click unless broadcast.
    const toSend = urls.filter((u) => vars.click_id || marketing.broadcastPostbacks);
    if (!toSend.length) {
      return { skipped: true, reason: 'no_postback_targets', clickId: vars.click_id };
    }

    const results: Array<{ network: string; ok: boolean; status?: number; error?: string }> = [];
    for (const t of toSend) {
      try {
        const res = await fetch(t.url, {
          method: 'GET',
          headers: { Accept: 'application/json, text/plain, */*' },
          signal: AbortSignal.timeout(12_000),
        });
        results.push({ network: t.network, ok: res.ok, status: res.status });
        this.logger.log(`Postback ${t.network} → ${res.status} order=${payload.orderNumber}`);
      } catch (err: any) {
        results.push({ network: t.network, ok: false, error: err?.message || String(err) });
        this.logger.warn(`Postback ${t.network} failed: ${err?.message}`);
      }
    }
    return { skipped: false, results };
  }
}

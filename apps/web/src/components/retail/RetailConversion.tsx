'use client';

import { useEffect, useRef } from 'react';
import {
  clearPendingRetailPurchase,
  readPendingRetailPurchase,
  trackPurchase,
  type RetailAnalyticsItemInput,
} from '@/lib/retail-analytics';

type Props = {
  orderId?: string;
  orderNumber?: string;
  amountIrr?: number;
  shippingIrr?: number;
  /** product sku/ids for yektanet product API */
  skus?: string[];
  items?: RetailAnalyticsItemInput[];
  /**
   * GA4 purchase only after verified payment, and only when the API did not already send it.
   * Pass false for unpaid orders (COD / order created) and when `ga4ServerPurchase` is true.
   */
  sendGa4Purchase?: boolean;
};

function readOpaquePartnerCode(): string {
  try {
    const match = document.cookie.match(/(?:^|; )taranom_sp=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  } catch {
    return '';
  }
}

function readAff(): { raw?: string; network?: string; clickId?: string } {
  try {
    const raw = sessionStorage.getItem('taranom_aff') || undefined;
    if (!raw) return {};
    const pipe = raw.indexOf('|');
    if (pipe > 0) {
      return { raw, network: raw.slice(0, pipe).toLowerCase(), clickId: raw.slice(pipe + 1) };
    }
    return { raw, network: 'generic', clickId: raw };
  } catch {
    return {};
  }
}

/**
 * Client-side purchase / conversion events for Yektanet, Meta, and network pixels.
 * GA4 purchase is fired only after authoritative success, with IRR values and dedup.
 */
export function RetailConversion({
  orderId,
  orderNumber,
  amountIrr = 0,
  shippingIrr,
  skus = [],
  items,
  sendGa4Purchase = true,
}: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (!orderId && !orderNumber) return;
    fired.current = true;

    const aff = readAff();
    const amountToman = Math.round(amountIrr / 10);
    const w = window as Window & {
      yektanet?: (...args: unknown[]) => void;
      fbq?: (...args: unknown[]) => void;
      dataLayer?: unknown[];
    };

    try {
      if (typeof w.yektanet === 'function') {
        const list = skus.length ? skus : ['order'];
        for (const sku of list) {
          w.yektanet('product', 'purchase', {
            sku,
            price: amountToman,
            order_id: orderNumber || orderId,
            quantity: 1,
          });
        }
      }
    } catch {
      /* ignore */
    }

    try {
      if (typeof w.fbq === 'function') {
        w.fbq('track', 'Purchase', {
          value: amountToman,
          currency: 'IRR',
          content_ids: skus,
          content_type: 'product',
        });
      }
    } catch {
      /* ignore */
    }

    try {
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({
        event: 'taranom_affiliate_purchase',
        order_id: orderNumber || orderId,
        value: amountToman,
        currency: 'IRR',
        affiliate_network: aff.network,
      });
      w.dispatchEvent?.(
        new CustomEvent('taranom:purchase', {
          detail: {
            orderId,
            orderNumber,
            amountIrr,
            amountToman,
            affiliate: { network: aff.network },
            skus,
          },
        }),
      );
    } catch {
      /* ignore */
    }

    const pending = readPendingRetailPurchase();
    if (!sendGa4Purchase) {
      clearPendingRetailPurchase();
      return;
    }
    // Prefer the human order number (same id the API uses) when the pending stash belongs to this order.
    const pendingMatches =
      !!pending && (!orderId || pending.transactionIds.includes(orderId));
    const transactionId = String(
      orderNumber || (pendingMatches ? pending?.transactionIds[0] : '') || orderId || '',
    ).trim();
    const own = pendingMatches ? pending : null;
    const analyticsItems: RetailAnalyticsItemInput[] =
      items && items.length
        ? items
        : own?.items?.length
          ? own.items
          : (skus.length ? skus : []).map((sku) => ({ sku, name: sku, quantity: 1 }));
    const valueIrr = amountIrr > 0 ? amountIrr : own?.value ?? 0;

    trackPurchase({
      transactionId,
      valueIrr,
      items: analyticsItems,
      shippingIrr: shippingIrr ?? own?.shipping,
      extraTransactionIds: [orderId, orderNumber, ...(own?.transactionIds ?? [])].filter(
        (id): id is string => Boolean(id),
      ),
      affiliateNetwork: aff.network,
      affiliateCode: readOpaquePartnerCode(),
    });
  }, [orderId, orderNumber, amountIrr, shippingIrr, skus, items, sendGa4Purchase]);

  return null;
}

'use client';

import { useEffect, useRef } from 'react';
import {
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
};

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
    const transactionId = String(orderNumber || orderId || pending?.transactionIds[0] || '').trim();
    const analyticsItems: RetailAnalyticsItemInput[] =
      items && items.length
        ? items
        : pending?.items?.length
          ? pending.items
          : (skus.length ? skus : []).map((sku) => ({ sku, name: sku, quantity: 1 }));
    const valueIrr = amountIrr > 0 ? amountIrr : pending?.value ?? 0;

    trackPurchase({
      transactionId,
      valueIrr,
      items: analyticsItems,
      shippingIrr: shippingIrr ?? pending?.shipping,
      extraTransactionIds: [orderId, orderNumber, ...(pending?.transactionIds ?? [])].filter(
        (id): id is string => Boolean(id),
      ),
    });
  }, [orderId, orderNumber, amountIrr, shippingIrr, skus, items]);

  return null;
}

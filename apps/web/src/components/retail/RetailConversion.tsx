'use client';

import { useEffect } from 'react';

type Props = {
  orderId?: string;
  orderNumber?: string;
  amountIrr?: number;
  /** product sku/ids for yektanet product API */
  skus?: string[];
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
 * Client-side purchase / conversion events for Yektanet product API, Meta, and network pixels.
 * Mount on thank-you / payment-success screens. S2S postbacks are handled by the API.
 */
export function RetailConversion({ orderId, orderNumber, amountIrr = 0, skus = [] }: Props) {
  useEffect(() => {
    if (!orderId && !orderNumber) return;
    const aff = readAff();
    const amountToman = Math.round(amountIrr / 10);
    const w = window as any;

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

    // Generic dataLayer + custom event for Affer / Afsona / Takhfifan tag managers
    try {
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({
        event: 'purchase',
        order_id: orderNumber || orderId,
        value: amountToman,
        currency: 'IRR',
        affiliate_network: aff.network,
        click_id: aff.clickId,
      });
      w.dispatchEvent?.(
        new CustomEvent('taranom:purchase', {
          detail: {
            orderId,
            orderNumber,
            amountIrr,
            amountToman,
            affiliate: aff,
            skus,
          },
        }),
      );
    } catch {
      /* ignore */
    }

    // Google Analytics 4 purchase (if gtag loaded by GoogleAnalyticsProvider)
    try {
      if (typeof w.gtag === 'function') {
        w.gtag('event', 'purchase', {
          transaction_id: orderNumber || orderId,
          value: amountToman,
          currency: 'IRR',
          items: (skus.length ? skus : ['order']).map((sku) => ({
            item_id: sku,
            quantity: 1,
          })),
        });
      }
    } catch {
      /* ignore */
    }
  }, [orderId, orderNumber, amountIrr, skus]);

  return null;
}

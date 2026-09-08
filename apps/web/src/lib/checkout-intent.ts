import { apiClient } from './api';
import { getToken } from './auth';

let timer: ReturnType<typeof setTimeout> | null = null;
let lastSent = 0;

/** Idle beacon for logged-in shoppers on checkout. No-op without JWT/customer. */
export function pulseCheckoutIntent(channel: 'RETAIL' | 'WHOLESALE') {
  if (typeof window === 'undefined') return;
  if (!getToken()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const now = Date.now();
    if (now - lastSent < 60_000) return;
    lastSent = now;
    apiClient
      .post('/storefront/marketing/checkout-intent', { channel })
      .catch(() => undefined);
  }, 8000);
}

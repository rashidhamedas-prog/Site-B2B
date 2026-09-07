import { apiClient } from './api';
import { getToken } from './auth';

function phoneFromShopperToken(): string {
  const token = getToken();
  if (!token) return '';
  try {
    const part = token.split('.')[1];
    if (!part) return '';
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return String(json?.phone || '');
  } catch {
    return '';
  }
}

const SESSION_KEY = 'taranom_cart_session';

export function cartSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id || id.length < 8) {
      id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `tmp${Date.now()}`;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

export function pulseCartHeartbeat(input: {
  channel: 'RETAIL' | 'WHOLESALE';
  items: Array<{ productId?: string; name?: string; quantity?: number }>;
  phone?: string;
}) {
  if (typeof window === 'undefined') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    apiClient
      .post('/cart/heartbeat', {
        channel: input.channel,
        sessionId: cartSessionId(),
        phone: input.phone || phoneFromShopperToken(),
        items: input.items,
      })
      .catch(() => undefined);
  }, 4000);
}

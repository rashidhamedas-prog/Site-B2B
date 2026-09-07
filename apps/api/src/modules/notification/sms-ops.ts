export type SmsChannel = 'WHOLESALE' | 'RETAIL';

export type SmsOpsEvent = 'orderPaidAdmin' | 'abandonedCart' | 'stockOutAdmin';

export interface SmsOpsSettings {
  retail: Record<SmsOpsEvent, boolean>;
  wholesale: Record<SmsOpsEvent, boolean>;
}

const EVENTS: SmsOpsEvent[] = ['orderPaidAdmin', 'abandonedCart', 'stockOutAdmin'];

export function resolveSmsOps(raw?: unknown): SmsOpsSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
  const one = (side: Record<string, any> | undefined): Record<SmsOpsEvent, boolean> => {
    const out = {} as Record<SmsOpsEvent, boolean>;
    for (const ev of EVENTS) {
      const nested = side?.[ev];
      const legacy = src[ev];
      out[ev] = nested !== false && legacy !== false;
    }
    return out;
  };
  return {
    retail: one(src.retail),
    wholesale: one(src.wholesale),
  };
}

export function smsOpsEnabled(ops: SmsOpsSettings, channel: SmsChannel, event: SmsOpsEvent): boolean {
  return ops[channel === 'RETAIL' ? 'retail' : 'wholesale'][event] !== false;
}

export function isIranMobile(raw?: string | null): boolean {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('9')) return true;
  if (d.length === 11 && d.startsWith('09')) return true;
  if (d.length === 12 && d.startsWith('989')) return true;
  return false;
}

export function normalizeIranMobile(raw?: string | null): string {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('9')) return `0${d}`;
  if (d.length === 12 && d.startsWith('989')) return `0${d.slice(2)}`;
  return d;
}

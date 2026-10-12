import { SMS_IR_BULK_MAX } from './customer-marketing.constants';

export type CampaignAudienceFilter = {
  grantedOnly: boolean;
  customerIds: string[];
  bodyOverride: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Deduplicate, validate UUID shape, and cap to SMS.ir bulk max. */
export function normalizeCustomerIds(raw: unknown, max = SMS_IR_BULK_MAX): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!UUID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export function parseCampaignAudienceFilter(filter: unknown): CampaignAudienceFilter {
  const obj = filter && typeof filter === 'object' && !Array.isArray(filter)
    ? (filter as Record<string, unknown>)
    : {};
  const bodyRaw = obj.bodyOverride;
  const bodyOverride =
    typeof bodyRaw === 'string' && bodyRaw.trim() ? bodyRaw.trim() : null;
  return {
    grantedOnly: obj.grantedOnly !== false,
    customerIds: normalizeCustomerIds(obj.customerIds),
    bodyOverride,
  };
}

export function maskPhone(phone: string | null | undefined): string | null {
  const p = String(phone || '').replace(/\D/g, '');
  if (p.length < 6) return p || null;
  return `${p.slice(0, 4)}…${p.slice(-2)}`;
}

export function smsSegmentHint(body: string): { chars: number; segments: number } {
  const chars = [...String(body || '')].length;
  // Persian SMS is UCS-2: 70 chars/segment (67 thereafter). Latin: 160/153.
  const hasNonGsm = /[^\x00-\x7F]/.test(body || '');
  if (!chars) return { chars: 0, segments: 0 };
  if (hasNonGsm) {
    if (chars <= 70) return { chars, segments: 1 };
    return { chars, segments: Math.ceil(chars / 67) };
  }
  if (chars <= 160) return { chars, segments: 1 };
  return { chars, segments: Math.ceil(chars / 153) };
}

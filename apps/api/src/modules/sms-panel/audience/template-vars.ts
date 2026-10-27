import { extractPlaceholders } from '../domain/template';
import { isAudienceSource, type AudienceSource } from './audience.types';

export const TEMPLATE_VAR_KEYS = [
  'name',
  'city',
  'businessName',
  'partnerName',
  'lastOrderNumber',
  'link',
] as const;

export type TemplateVarKey = (typeof TEMPLATE_VAR_KEYS)[number];

const ALL_SOURCES: AudienceSource[] = [
  'WHOLESALE',
  'WHOLESALE_REFERRAL',
  'SALES_PARTNER',
  'RETAIL',
];

export const TEMPLATE_VAR_CATALOG: Record<
  TemplateVarKey,
  { sources: AudienceSource[]; maxLen: number }
> = {
  name: { sources: ALL_SOURCES, maxLen: 40 },
  city: { sources: ALL_SOURCES, maxLen: 32 },
  businessName: { sources: ['WHOLESALE'], maxLen: 60 },
  partnerName: { sources: ['SALES_PARTNER', 'WHOLESALE_REFERRAL'], maxLen: 60 },
  lastOrderNumber: { sources: ['WHOLESALE', 'RETAIL'], maxLen: 24 },
  link: { sources: ALL_SOURCES, maxLen: 80 },
};

export class TemplateVarError extends Error {
  readonly code = 'SMS_TEMPLATE_VAR';

  constructor(message: string) {
    super(message);
  }
}

export function isTemplateVar(key: string): key is TemplateVarKey {
  return (TEMPLATE_VAR_KEYS as readonly string[]).includes(key);
}

export function capVarValue(key: string, value: string): string {
  const max = isTemplateVar(key) ? TEMPLATE_VAR_CATALOG[key].maxLen : 40;
  return String(value || '').slice(0, max);
}

/** Keep only known keys, trimmed and capped, in catalog order. */
export function normalizeFallbacks(
  input: Record<string, string> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of TEMPLATE_VAR_KEYS) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) out[key] = capVarValue(key, value.trim());
  }
  return out;
}

/**
 * Fill `{var}` per recipient. Unknown names throw. Empty values use the
 * campaign fallback. Every written value is capped.
 */
export function renderForContact(
  body: string,
  vars: Record<string, string | null | undefined>,
  fallbacks: Record<string, string | null | undefined>,
): string {
  const keys = extractPlaceholders(body);
  for (const key of keys) {
    if (!isTemplateVar(key)) throw new TemplateVarError(`UNKNOWN_PLACEHOLDER:${key}`);
  }
  return String(body || '').replace(/\{(\w+)\}/g, (_, key: string) => {
    const raw = vars[key];
    const chosen = raw == null || String(raw).trim() === '' ? fallbacks[key] : raw;
    if (chosen == null || String(chosen).trim() === '') {
      throw new TemplateVarError(`MISSING_FALLBACK:${key}`);
    }
    return capVarValue(key, String(chosen));
  });
}

export function assertTemplateBody(
  body: string,
  fallbacks?: Record<string, string> | null,
  opts?: { requireFallbacks?: boolean; messageClass?: string },
): string[] {
  const keys = extractPlaceholders(body);
  for (const key of keys) {
    if (isTemplateVar(key)) continue;
    if (key === 'code' && opts?.messageClass === 'OTP') continue;
    throw new TemplateVarError(`UNKNOWN_PLACEHOLDER:${key}`);
  }
  const known = keys.filter(isTemplateVar);
  if (opts?.requireFallbacks) {
    const ready = normalizeFallbacks(fallbacks);
    for (const key of known) {
      if (!ready[key]) throw new TemplateVarError(`MISSING_FALLBACK:${key}`);
    }
  }
  return keys;
}

export function sourceWarnings(
  body: string,
  sources: readonly string[],
): { key: TemplateVarKey; code: 'SOURCE_MISMATCH' }[] {
  const knownSources = sources.filter(isAudienceSource);
  if (!knownSources.length) return [];
  const out: { key: TemplateVarKey; code: 'SOURCE_MISMATCH' }[] = [];
  for (const key of extractPlaceholders(body)) {
    if (!isTemplateVar(key)) continue;
    const allowed = TEMPLATE_VAR_CATALOG[key].sources;
    if (!knownSources.some((source) => allowed.includes(source))) {
      out.push({ key, code: 'SOURCE_MISMATCH' });
    }
  }
  return out;
}

/** Longest legal substitution: each variable becomes maxLen Persian noons. */
export function worstCaseBody(body: string): string {
  return String(body || '').replace(/\{(\w+)\}/g, (token, key: string) => {
    if (!isTemplateVar(key)) return token;
    return 'ن'.repeat(TEMPLATE_VAR_CATALOG[key].maxLen);
  });
}

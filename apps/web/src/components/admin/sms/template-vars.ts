/** Keep in sync with apps/api sms-panel/audience/template-vars.ts */

export const TEMPLATE_VAR_KEYS = [
  'name',
  'city',
  'businessName',
  'partnerName',
  'lastOrderNumber',
  'link',
] as const;

export type TemplateVarKey = (typeof TEMPLATE_VAR_KEYS)[number];

export const TEMPLATE_VAR_LABELS: Record<TemplateVarKey, string> = {
  name: 'نام',
  city: 'شهر',
  businessName: 'نام کسب‌وکار',
  partnerName: 'نام همکار',
  lastOrderNumber: 'شماره سفارش',
  link: 'لینک',
};

const MAX_LEN: Record<TemplateVarKey, number> = {
  name: 40,
  city: 32,
  businessName: 60,
  partnerName: 60,
  lastOrderNumber: 24,
  link: 80,
};

const SOURCES: Record<TemplateVarKey, string[]> = {
  name: ['WHOLESALE', 'WHOLESALE_REFERRAL', 'SALES_PARTNER', 'RETAIL'],
  city: ['WHOLESALE', 'WHOLESALE_REFERRAL', 'SALES_PARTNER', 'RETAIL'],
  businessName: ['WHOLESALE'],
  partnerName: ['SALES_PARTNER', 'WHOLESALE_REFERRAL'],
  lastOrderNumber: ['WHOLESALE', 'RETAIL'],
  link: ['WHOLESALE', 'WHOLESALE_REFERRAL', 'SALES_PARTNER', 'RETAIL'],
};

export function isTemplateVar(key: string): key is TemplateVarKey {
  return (TEMPLATE_VAR_KEYS as readonly string[]).includes(key);
}

export function insertVariable(body: string, key: string, cursor: number): { body: string; cursor: number } {
  if (!isTemplateVar(key)) throw new Error(`UNKNOWN_PLACEHOLDER:${key}`);
  const token = `{${key}}`;
  const at = Math.max(0, Math.min(body.length, cursor));
  return {
    body: body.slice(0, at) + token + body.slice(at),
    cursor: at + token.length,
  };
}

export function renderForContact(
  body: string,
  vars: Record<string, string | null | undefined>,
  fallbacks: Record<string, string | null | undefined>,
): string {
  return String(body || '').replace(/\{(\w+)\}/g, (token, key: string) => {
    if (!isTemplateVar(key)) throw new Error(`UNKNOWN_PLACEHOLDER:${key}`);
    const raw = vars[key];
    const chosen = raw == null || String(raw).trim() === '' ? fallbacks[key] : raw;
    if (chosen == null || String(chosen).trim() === '') throw new Error(`MISSING_FALLBACK:${key}`);
    return String(chosen).slice(0, MAX_LEN[key]);
  });
}

export function worstCaseBody(body: string): string {
  return String(body || '').replace(/\{(\w+)\}/g, (token, key: string) => {
    if (!isTemplateVar(key)) return token;
    return 'ن'.repeat(MAX_LEN[key]);
  });
}

export function sourceWarnings(body: string, sources: string[]): { key: string; code: 'SOURCE_MISMATCH' }[] {
  if (!sources.length) return [];
  const out: { key: string; code: 'SOURCE_MISMATCH' }[] = [];
  const re = /\{(\w+)\}/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = re.exec(body))) {
    const key = match[1];
    if (!isTemplateVar(key) || seen.has(key)) continue;
    seen.add(key);
    if (!sources.some((source) => SOURCES[key].includes(source))) {
      out.push({ key, code: 'SOURCE_MISMATCH' });
    }
  }
  return out;
}

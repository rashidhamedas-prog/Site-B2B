/** Server-owned UTF-8. Never build this string in a Windows SSH one-liner. */
export const CANARY_PING_TEXT =
  'تست اتصال ترنم. اگر این پیام را فارسی می‌بینید، رمزگذاری درست است.';

export function canaryPingHasPersian(text = CANARY_PING_TEXT): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function canaryPingLooksMojibake(text = CANARY_PING_TEXT): boolean {
  return /\?{2,}/.test(text) || !canaryPingHasPersian(text);
}

export const DEFAULT_PRODUCT_TEMPLATE = '{name} — {price} تومان\n{url}';

export function formatTomanFromRial(value: unknown): string {
  const rial = Number(value);
  if (!Number.isFinite(rial) || rial <= 0) return '';
  return String(Math.round(rial / 10));
}

export function renderPublicationText(
  body: string,
  vars: { name?: unknown; price?: unknown; url?: unknown; sku?: unknown },
): string {
  const template = String(body || DEFAULT_PRODUCT_TEMPLATE);
  return template
    .replace(/\{name\}/g, String(vars.name || '').trim())
    .replace(/\{price\}/g, String(vars.price || '').trim())
    .replace(/\{url\}/g, String(vars.url || '').trim())
    .replace(/\{sku\}/g, String(vars.sku || '').trim())
    .trim();
}

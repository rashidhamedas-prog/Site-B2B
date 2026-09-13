/** Shared product image alt rules. Keep in sync with apps/api product-image-alt.ts */

export const PRODUCT_IMAGE_ALT_MAX = 160;

export type ProductImageRole = 'front' | 'back' | 'side' | 'detail' | 'fabric' | 'color';

export type ProductImageAltDraft = {
  name?: string | null;
  fabric?: string | null;
  color?: string | null;
  role?: ProductImageRole | null;
  index?: number;
};

const ROLE_FA: Record<ProductImageRole, string> = {
  front: 'از روبرو',
  back: 'نمای پشت',
  side: 'نمای کنار',
  detail: 'جزئیات دوخت',
  fabric: 'بافت پارچه',
  color: '',
};

export function sanitizeProductImageAlt(raw: unknown): string {
  const text = String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, PRODUCT_IMAGE_ALT_MAX);
}

export function normalizeProductImageAlts(
  raw: unknown,
  allowedUrls?: Iterable<string>,
): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const allow = allowedUrls
    ? new Set([...allowedUrls].map((u) => String(u || '').trim()).filter(Boolean))
    : null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const url = String(key || '').trim();
    if (!url || url.length > 500) continue;
    if (/^(javascript|data|vbscript):/i.test(url)) continue;
    if (allow && !allow.has(url)) continue;
    const alt = sanitizeProductImageAlt(value);
    if (!alt) continue;
    out[url] = alt;
    if (Object.keys(out).length >= 40) break;
  }
  return out;
}

export function suggestProductImageAlt(draft: ProductImageAltDraft): string {
  const name = sanitizeProductImageAlt(draft.name);
  if (!name) return '';
  const fabric = sanitizeProductImageAlt(draft.fabric);
  const color = sanitizeProductImageAlt(draft.color);
  const role = draft.role ?? (draft.index === 0 ? 'front' : draft.index && draft.index > 0 ? 'detail' : null);

  if (color) {
    return sanitizeProductImageAlt([name, `رنگ ${color}`, fabric].filter(Boolean).join(' — '));
  }
  if (role === 'fabric' && fabric) {
    return sanitizeProductImageAlt(`بافت ${fabric} ${name}`);
  }
  if (role && ROLE_FA[role]) {
    return sanitizeProductImageAlt(`${name} ${ROLE_FA[role]}`);
  }
  if (typeof draft.index === 'number' && draft.index > 0) {
    return sanitizeProductImageAlt(`${name} — تصویر ${draft.index + 1}`);
  }
  return name;
}

export function resolveProductImageAlt(
  imageAlts: Record<string, string> | null | undefined,
  url: string | null | undefined,
  fallback: ProductImageAltDraft,
): string {
  const stored = url ? sanitizeProductImageAlt(imageAlts?.[url]) : '';
  return stored || suggestProductImageAlt(fallback);
}

export function jsonLdImageObjects(
  urls: Array<string | null | undefined>,
  imageAlts: Record<string, string> | null | undefined,
  fallback: ProductImageAltDraft,
  abs: (url: string) => string | undefined,
): Array<{ '@type': 'ImageObject'; url: string; name: string; caption: string }> {
  const out: Array<{ '@type': 'ImageObject'; url: string; name: string; caption: string }> = [];
  urls.forEach((raw, index) => {
    if (!raw) return;
    const url = abs(raw);
    if (!url) return;
    const name = resolveProductImageAlt(imageAlts, raw, { ...fallback, index });
    out.push({ '@type': 'ImageObject', url, name, caption: name });
  });
  return out;
}

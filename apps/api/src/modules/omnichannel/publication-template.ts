/** Structured Telegram product posts. Legacy `{name} — {price}` strings still parse. */

export const TEMPLATE_TOKENS = [
  'name',
  'sku',
  'fabric',
  'sizes',
  'colors',
  'colorCount',
  'length',
  'price',
  'packQty',
  'packPrice',
  'url',
] as const;

export type TemplateToken = (typeof TEMPLATE_TOKENS)[number];

export const TELEGRAM_CAPTION_LIMIT = 1024;
export const TELEGRAM_TEXT_LIMIT = 4096;
export const TELEGRAM_ALBUM_LIMIT = 10;

export type TemplateBlock =
  | { id: string; type: 'photos'; enabled: boolean; maxPhotos: number }
  | { id: string; type: 'title'; enabled: boolean; emoji: string; token: TemplateToken }
  | { id: string; type: 'field'; enabled: boolean; emoji: string; label: string; token: TemplateToken; suffix?: string }
  | { id: string; type: 'trust'; enabled: boolean; emoji: string; text: string }
  | { id: string; type: 'text'; enabled: boolean; text: string };

export type TemplateLayout = { v: 1; blocks: TemplateBlock[] };

export type PublicationVars = Record<TemplateToken, string> & { images: string[] };

export type RenderedPublication = { text: string; photoUrls: string[] };

const ALLOWED_PHOTO_HOSTS = new Set([
  'poshaktaranom.com',
  'www.poshaktaranom.com',
  'poshaktaranom.ir',
  'www.poshaktaranom.ir',
  'api.poshaktaranom.com',
  'storage.poshaktaranom.com',
]);

export function formatChannelToman(rial: unknown): string {
  const n = Number(rial);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(Math.round(n / 10)).replace(/\B(?=(\d{3})+(?!\d))/g, '/');
}

export function sizesLine(sizeType?: string | null): string {
  const kind = String(sizeType || '').toUpperCase();
  if (kind === 'TWO') return '۲ سایز (مناسب از ۳۸ تا ۴۸)';
  if (kind === 'THREE') return '۳ سایز (مناسب از ۳۸ تا ۴۸)';
  if (kind === 'FREE') return 'فری سایز (مناسب از ۳۸ تا ۴۸)';
  return '';
}

export function newBlockId(): string {
  return `b${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultWholesaleLayout(): TemplateLayout {
  return {
    v: 1,
    blocks: [
      { id: 'p1', type: 'photos', enabled: true, maxPhotos: 5 },
      { id: 't1', type: 'title', enabled: true, emoji: '🌿', token: 'name' },
      { id: 'f1', type: 'field', enabled: true, emoji: '▫️', label: 'جنس', token: 'fabric' },
      { id: 'f2', type: 'field', enabled: true, emoji: '▫️', label: 'سایزبندی', token: 'sizes' },
      { id: 'f3', type: 'field', enabled: true, emoji: '▫️', label: 'قد کار', token: 'length' },
      { id: 'f4', type: 'field', enabled: true, emoji: '▫️', label: 'رنگبندی', token: 'colorCount' },
      { id: 'f5', type: 'field', enabled: true, emoji: '▫️', label: 'کد', token: 'sku' },
      { id: 'f6', type: 'field', enabled: true, emoji: '💵', label: 'قیمت', token: 'price', suffix: ' تومان' },
      { id: 'f7', type: 'field', enabled: true, emoji: '📦', label: 'تعداد در هر سری', token: 'packQty' },
      { id: 'q1', type: 'trust', enabled: true, emoji: '✅', text: 'پارچه شست شده' },
      { id: 'q2', type: 'trust', enabled: true, emoji: '✅', text: 'بدون آبرفت پس از شستشو' },
      { id: 'q3', type: 'trust', enabled: true, emoji: '✅', text: 'بدون رنگ‌دهی' },
      { id: 'q4', type: 'trust', enabled: true, emoji: '✅', text: 'دوخت تمیز و کیفیت تضمین‌شده' },
      { id: 'q5', type: 'trust', enabled: true, emoji: '✅', text: 'تولید مستقیم از تولیدی ترنم' },
      { id: 'x1', type: 'text', enabled: true, text: '📦 فروش به صورت عمده' },
      { id: 'x2', type: 'text', enabled: true, text: '🚚 ارسال به سراسر ایران' },
      { id: 'x3', type: 'text', enabled: true, text: '📩 ثبت سفارش و استعلام قیمت همکاری:' },
      { id: 'x4', type: 'text', enabled: true, text: '@Taranomrashid' },
      { id: 'x5', type: 'text', enabled: true, text: '☎️ تماس:09152424624' },
      { id: 'x6', type: 'text', enabled: true, text: '📢 کانال تولیدی ترنم:' },
      { id: 'x7', type: 'text', enabled: true, text: '@toliditaranom' },
      { id: 'x8', type: 'text', enabled: true, text: '#تولیدی_ترنم #فروش_عمده #پوشاک_زنانه' },
    ],
  };
}

export function defaultRetailLayout(): TemplateLayout {
  return {
    v: 1,
    blocks: [
      { id: 'p1', type: 'photos', enabled: true, maxPhotos: 5 },
      { id: 't1', type: 'title', enabled: true, emoji: '🌿', token: 'name' },
      { id: 'f1', type: 'field', enabled: true, emoji: '▫️', label: 'جنس', token: 'fabric' },
      { id: 'f2', type: 'field', enabled: true, emoji: '▫️', label: 'سایزبندی', token: 'sizes' },
      { id: 'f3', type: 'field', enabled: true, emoji: '▫️', label: 'قد کار', token: 'length' },
      { id: 'f4', type: 'field', enabled: true, emoji: '▫️', label: 'رنگبندی', token: 'colors' },
      { id: 'f5', type: 'field', enabled: true, emoji: '▫️', label: 'کد', token: 'sku' },
      { id: 'f6', type: 'field', enabled: true, emoji: '💵', label: 'قیمت', token: 'price', suffix: ' تومان' },
      { id: 'x1', type: 'text', enabled: true, text: '{url}' },
    ],
  };
}

export function defaultLayoutFor(channel: string): TemplateLayout {
  return channel === 'WHOLESALE' ? defaultWholesaleLayout() : defaultRetailLayout();
}

function isToken(value: unknown): value is TemplateToken {
  return typeof value === 'string' && (TEMPLATE_TOKENS as readonly string[]).includes(value);
}

function asBlock(raw: unknown, index: number): TemplateBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id || `b${index + 1}`).slice(0, 32);
  const enabled = row.enabled !== false;
  if (row.type === 'photos') {
    const maxPhotos = Math.max(1, Math.min(TELEGRAM_ALBUM_LIMIT, Number(row.maxPhotos) || 5));
    return { id, type: 'photos', enabled, maxPhotos };
  }
  if (row.type === 'title' && isToken(row.token)) {
    return { id, type: 'title', enabled, emoji: String(row.emoji || '').slice(0, 8), token: row.token };
  }
  if (row.type === 'field' && isToken(row.token)) {
    return {
      id,
      type: 'field',
      enabled,
      emoji: String(row.emoji || '▫️').slice(0, 8),
      label: String(row.label || '').slice(0, 40),
      token: row.token,
      suffix: row.suffix ? String(row.suffix).slice(0, 24) : undefined,
    };
  }
  if (row.type === 'trust') {
    return {
      id,
      type: 'trust',
      enabled,
      emoji: String(row.emoji || '✅').slice(0, 8),
      text: String(row.text || '').slice(0, 200),
    };
  }
  if (row.type === 'text') {
    return { id, type: 'text', enabled, text: String(row.text || '').slice(0, 500) };
  }
  return null;
}

const LEGACY_PRODUCT_TEMPLATE = '{name} — {price} تومان\n{url}';

function compactTemplate(value: string): string {
  return value.replace(/\s+/g, '');
}

export function isLegacyProductTemplate(body?: string | null): boolean {
  const raw = String(body || '').trim();
  if (!raw) return true;
  if (compactTemplate(raw) === compactTemplate(LEGACY_PRODUCT_TEMPLATE)) return true;
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { v?: unknown; blocks?: Array<{ type?: unknown; text?: unknown }> };
      if (parsed.v === 1 && Array.isArray(parsed.blocks) && parsed.blocks.length === 1 && parsed.blocks[0]?.type === 'text') {
        return isLegacyProductTemplate(String(parsed.blocks[0].text || ''));
      }
      return false;
    } catch {
      return true;
    }
  }
  return /\{name\}/.test(raw) && /\{price\}/.test(raw) && /\{url\}/.test(raw) && raw.length < 96;
}

export function extractProductLookupKey(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (ALLOWED_PHOTO_HOSTS.has(host) || host.endsWith('poshaktaranom.ir') || host.endsWith('poshaktaranom.com')) {
      const parts = url.pathname.split('/').filter(Boolean);
      const idx = parts.lastIndexOf('products');
      if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]).slice(0, 120);
    }
  } catch {
    /* not a URL */
  }
  return value.replace(/^\/+|\/+$/g, '').slice(0, 120);
}

export function imageCandidates(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  const out: string[] = [];
  for (const item of images) {
    if (typeof item === 'string' && item.trim()) {
      out.push(item.trim());
      continue;
    }
    if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      const href = rec.url || rec.src || rec.href;
      if (typeof href === 'string' && href.trim()) out.push(href.trim());
    }
  }
  return out;
}

export function parseTemplateLayout(body?: string | null, channel = 'RETAIL'): TemplateLayout {
  if (isLegacyProductTemplate(body)) return defaultLayoutFor(channel);
  const raw = String(body || '').trim();
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { v?: unknown; blocks?: unknown };
      if (parsed.v === 1 && Array.isArray(parsed.blocks)) {
        const blocks = parsed.blocks.map(asBlock).filter((row): row is TemplateBlock => !!row);
        if (blocks.length) return { v: 1, blocks };
      }
    } catch {
      /* fall through to legacy */
    }
  }
  if (raw) {
    return { v: 1, blocks: [{ id: 'legacy', type: 'text', enabled: true, text: raw }] };
  }
  return defaultLayoutFor(channel);
}

export function stringifyTemplateLayout(layout: TemplateLayout): string {
  return JSON.stringify({ v: 1, blocks: layout.blocks });
}

export function publicProductPhotoUrl(channel: 'RETAIL' | 'WHOLESALE', raw: string): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed.length > 500) return null;
  if (/[\u0000-\u001F]/.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed) && !/^https:\/\//i.test(trimmed)) return null;
  const origin = channel === 'RETAIL' ? 'https://www.poshaktaranom.ir' : 'https://poshaktaranom.com';
  let url: URL;
  try {
    url = /^https:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, origin);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (!ALLOWED_PHOTO_HOSTS.has(url.hostname.toLowerCase())) return null;
  if (url.pathname.includes('..')) return null;
  return `${url.origin}${url.pathname}${url.search}`;
}

export function sanitizePhotoUrls(
  channel: 'RETAIL' | 'WHOLESALE',
  urls: unknown,
  max = TELEGRAM_ALBUM_LIMIT,
): string[] {
  if (!Array.isArray(urls) || max <= 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of urls) {
    const href = publicProductPhotoUrl(channel, String(item || ''));
    if (!href || seen.has(href)) continue;
    seen.add(href);
    out.push(href);
    if (out.length >= Math.max(1, Math.min(TELEGRAM_ALBUM_LIMIT, max))) break;
  }
  return out;
}

function tokenValue(vars: PublicationVars, token: TemplateToken): string {
  return String(vars[token] || '').trim();
}

function applyInlineTokens(text: string, vars: PublicationVars): string {
  return String(text || '').replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => {
    return isToken(key) ? tokenValue(vars, key) : '';
  }).trim();
}

export function renderPublicationLayout(
  layout: TemplateLayout,
  vars: PublicationVars,
  channel: 'RETAIL' | 'WHOLESALE' = 'RETAIL',
): RenderedPublication {
  const lines: string[] = [];
  let maxPhotos = 0;
  for (const block of layout.blocks) {
    if (!block.enabled) continue;
    if (block.type === 'photos') {
      maxPhotos = Math.max(maxPhotos, block.maxPhotos);
      continue;
    }
    if (block.type === 'title') {
      const value = tokenValue(vars, block.token);
      if (!value) continue;
      lines.push(`${block.emoji ? `${block.emoji} ` : ''}${value}`.trim());
      continue;
    }
    if (block.type === 'field') {
      const value = tokenValue(vars, block.token);
      if (!value) continue;
      const prefix = block.label ? `${block.emoji} ${block.label}: ` : `${block.emoji} `;
      lines.push(`${prefix}${value}${block.suffix || ''}`.trim());
      continue;
    }
    if (block.type === 'trust') {
      const text = applyInlineTokens(block.text, vars);
      if (!text) continue;
      lines.push(`${block.emoji ? `${block.emoji} ` : ''}${text}`.trim());
      continue;
    }
    const text = applyInlineTokens(block.text, vars);
    if (text) lines.push(text);
  }
  return {
    text: lines.join('\n').slice(0, TELEGRAM_TEXT_LIMIT),
    photoUrls: sanitizePhotoUrls(channel, vars.images, maxPhotos || 0),
  };
}

export function emptyPublicationVars(): PublicationVars {
  return {
    name: '',
    sku: '',
    fabric: '',
    sizes: '',
    colors: '',
    colorCount: '',
    length: '',
    price: '',
    packQty: '',
    packPrice: '',
    url: '',
    images: [],
  };
}

export const SAMPLE_WHOLESALE_VARS: PublicationVars = {
  name: 'مانتو جلوباز کتان مدل کیان',
  sku: '332',
  fabric: 'کتان ۴۳۰ گرم کجراه',
  sizes: 'فری سایز (مناسب از ۳۸ تا ۴۸)',
  colors: 'مشکی، زیتونی، زرشکی، خاکی، کرمی',
  colorCount: '۵ رنگ',
  length: '۷۵ سانتی متر',
  price: '1/207/000',
  packQty: '۵ عدد',
  packPrice: '6/035/000',
  url: 'https://poshaktaranom.com/products/kian',
  images: [],
};

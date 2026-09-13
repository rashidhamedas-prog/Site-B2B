const TITLE_MAX = 200;
const DESCRIPTION_MAX = 320;
const ALT_MAX = 160;
const URL_MAX = 500;

function cleanText(raw: unknown, max: number): string {
  return String(raw ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanUrl(raw: unknown): string {
  const value = cleanText(raw, URL_MAX);
  if (!value) return '';
  if (/^(javascript|data|vbscript):/i.test(value)) return '';
  if (value.startsWith('/') || /^https?:\/\//i.test(value)) return value;
  return '';
}

/** Allowlisted page SEO. Never persist arbitrary HTML or script URLs. */
export function sanitizeCmsPageSeo(raw: unknown): Record<string, string> | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const robots = cleanText(src.robots, 16).toLowerCase();
  const out: Record<string, string> = {};
  const title = cleanText(src.title, TITLE_MAX);
  const description = cleanText(src.description, DESCRIPTION_MAX);
  const ogImage = cleanUrl(src.ogImage);
  const ogAlt = cleanText(src.ogAlt, ALT_MAX);
  const canonical = cleanUrl(src.canonical);
  if (title) out.title = title;
  if (description) out.description = description;
  if (ogImage) out.ogImage = ogImage;
  if (ogAlt) out.ogAlt = ogAlt;
  if (canonical) out.canonical = canonical;
  if (robots === 'noindex' || robots === 'index') out.robots = robots;
  return Object.keys(out).length ? out : null;
}

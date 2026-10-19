// eslint-disable-next-line @typescript-eslint/no-require-imports
const sanitizeHtml = require('sanitize-html') as typeof import('sanitize-html');

/** Site-relative path only. Rejects schemes, protocol-relative URLs, and whitespace tricks. */
export function isInternalCategoryHref(raw: string): boolean {
  const value = String(raw ?? '').trim();
  if (!value || value.length > 300) return false;
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  if (/[\u0000-\u0020"'<>\\]/.test(value)) return false;
  if (value.includes('://') || value.includes('..')) return false;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return false;
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return false;
  if (/[\u0000-\u0020"'<>\\]/.test(decoded)) return false;
  if (decoded.includes('://') || decoded.includes('..')) return false;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(decoded)) return false;
  return /^\/[A-Za-z0-9._~:/?#\[\]@!$&()*+,;=%-]*$/.test(value);
}

function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

/**
 * Keep plain category copy unchanged. When the string is HTML, allow paragraphs,
 * emphasis, and internal links only.
 */
export function sanitizeCategoryCopy(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').replace(/\u0000/g, '').trim();
  if (!value) return null;
  if (!looksLikeHtml(value)) return value;

  const clean = sanitizeHtml(value, {
    allowedTags: ['p', 'br', 'strong', 'em', 'a'],
    allowedAttributes: { a: ['href'] },
    allowedSchemes: [],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (_tagName, attribs) => {
        const href = String(attribs.href || '').trim();
        if (!isInternalCategoryHref(href)) {
          return { tagName: 'span', attribs: {} };
        }
        return { tagName: 'a', attribs: { href } };
      },
    },
  }).trim();

  const text = clean
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  if (!text) return null;
  return clean;
}

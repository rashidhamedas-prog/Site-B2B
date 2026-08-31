// eslint-disable-next-line @typescript-eslint/no-require-imports
const sanitizeHtml = require('sanitize-html') as typeof import('sanitize-html');

export const CMS_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'pre', 'code', 'hr', 'div', 'span',
];

const HTMLISH_KEYS = new Set(['html', 'content', 'body', 'text', 'description', 'caption']);

export function sanitizeCmsHtml(html: string): string {
  return sanitizeHtml(html || '', {
    allowedTags: CMS_ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
      '*': ['class', 'id'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener' }, true),
    },
  });
}

function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value) || /on\w+\s*=/i.test(value) || /javascript:/i.test(value);
}

export function sanitizeCmsValue(value: unknown, key = ''): unknown {
  if (typeof value === 'string') {
    if (HTMLISH_KEYS.has(key) || looksLikeHtml(value)) {
      return sanitizeCmsHtml(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeCmsValue(item, key || String(index)));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
      out[childKey] = sanitizeCmsValue(child, childKey);
    }
    return out;
  }
  return value;
}

export function sanitizeCmsBlocks(blocks: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(blocks)) return [];
  return sanitizeCmsValue(blocks) as Array<Record<string, unknown>>;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sanitizeHtml = require('sanitize-html') as typeof import('sanitize-html');

export const BLOG_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'pre', 'code', 'hr', 'div', 'span',
];

export function sanitizeBlogHtml(html: string): string {
  return sanitizeHtml(html || '', {
    allowedTags: BLOG_ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
      '*': ['class', 'id'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener' }, true),
    },
  });
}

export function buildHowToJsonLd(howTo: {
  name: string;
  description?: string;
  totalTime?: string;
  estimatedCost?: { currency: string; value: number };
  supplies?: string[];
  tools?: string[];
  steps?: Array<{ title: string; description: string; imageUrl?: string; urlAnchor?: string; sortOrder?: number }>;
}) {
  if (!howTo?.name || !howTo.steps?.length) return null;
  const steps = [...howTo.steps].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: howTo.name,
    description: howTo.description,
    totalTime: howTo.totalTime,
    estimatedCost: howTo.estimatedCost
      ? { '@type': 'MonetaryAmount', currency: howTo.estimatedCost.currency, value: String(howTo.estimatedCost.value) }
      : undefined,
    supply: (howTo.supplies || []).map((s) => ({ '@type': 'HowToSupply', name: s })),
    tool: (howTo.tools || []).map((t) => ({ '@type': 'HowToTool', name: t })),
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.title,
      text: s.description,
      url: s.urlAnchor,
      image: s.imageUrl,
    })),
  };
}

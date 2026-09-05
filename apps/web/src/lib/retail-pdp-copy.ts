/** Retail PDP copy helpers — keep description selection out of the client component. */

const DANGEROUS = /<\/?(?:script|iframe|object|embed|form|link|meta|base)[^>]*>/gi;
const ON_ATTR = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_HREF = /\s(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi;

export function lightSanitizeHtml(html: string): string {
  return (html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(DANGEROUS, '')
    .replace(ON_ATTR, '')
    .replace(JS_HREF, '');
}

export function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

export function selectRetailPdpBody(product: {
  fullContent?: string | null;
  description?: string | null;
}): string {
  return [product.fullContent, product.description]
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';
}

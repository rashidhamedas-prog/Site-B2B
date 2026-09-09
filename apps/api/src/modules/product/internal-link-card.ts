export const LINK_EXCERPT_MAX = 140;
export const LINK_IMAGE_URL_MAX = 700;

export function plainExcerpt(text?: string | null, max = LINK_EXCERPT_MAX): string | null {
  const plain = String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return null;
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const atWord = cut.replace(/\s+\S*$/, '');
  return `${atWord || cut}…`;
}

export function firstImage(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value) return value;
  }
  return null;
}

/**
 * Allow only relative media paths or HTTPS URLs on Taranom hosts.
 * Rejects javascript/data, protocol-relative, path traversal, and other hosts.
 */
export function sanitizeGuideImageUrl(url?: string | null): string | null {
  const raw = String(url || '').trim();
  if (!raw || raw.length > LINK_IMAGE_URL_MAX) return null;
  if (raw.includes('..') || /[\s<>]/.test(raw)) return null;
  if (/^(javascript|data|vbscript):/i.test(raw)) return null;
  if (raw.startsWith('//')) return null;
  const cleaned = raw.split(/[?#]/)[0];
  if (cleaned.startsWith('/') && !cleaned.startsWith('//')) return cleaned;
  if (
    /^https:\/\/(?:www\.)?poshaktaranom\.(?:ir|com)\//i.test(cleaned) ||
    /^https:\/\/(?:api|storage)\.poshaktaranom\.com\//i.test(cleaned)
  ) {
    return cleaned;
  }
  return null;
}

export function applyGuideOverrides(
  resolved: { imageUrl: string | null; excerpt: string | null },
  override?: { imageUrl?: string | null; excerpt?: string | null },
): { imageUrl: string | null; excerpt: string | null } {
  return {
    imageUrl: sanitizeGuideImageUrl(override?.imageUrl) || resolved.imageUrl,
    excerpt: plainExcerpt(override?.excerpt) || resolved.excerpt,
  };
}

export function resolveInternalLinkCard(opts: {
  channel: 'RETAIL' | 'WHOLESALE';
  fallbackTitle?: string | null;
  product?: {
    images?: string[] | null;
    description?: string | null;
    seoMeta?: Record<string, string> | null;
  } | null;
  category?: {
    bannerUrl?: string | null;
    heroImage?: string | null;
    ogImage?: string | null;
    seoDescription?: string | null;
    introText?: string | null;
    wholesaleSeoDescription?: string | null;
    wholesaleIntroText?: string | null;
  } | null;
  blog?: {
    coverImage?: string | null;
    ogImage?: string | null;
    excerpt?: string | null;
  } | null;
}): { imageUrl: string | null; excerpt: string | null } {
  if (opts.product) {
    const seo = opts.product.seoMeta || {};
    const excerpt =
      opts.channel === 'RETAIL'
        ? plainExcerpt(seo.retailDescription || seo.description || opts.product.description)
        : plainExcerpt(seo.wholesaleDescription || seo.description || opts.product.description);
    return {
      imageUrl: firstImage(opts.product.images?.[0]),
      excerpt: excerpt || plainExcerpt(opts.fallbackTitle),
    };
  }
  if (opts.category) {
    const excerpt =
      opts.channel === 'RETAIL'
        ? plainExcerpt(opts.category.seoDescription || opts.category.introText)
        : plainExcerpt(
            opts.category.wholesaleSeoDescription ||
              opts.category.wholesaleIntroText ||
              opts.category.seoDescription ||
              opts.category.introText,
          );
    return {
      imageUrl: firstImage(opts.category.bannerUrl, opts.category.heroImage, opts.category.ogImage),
      excerpt: excerpt || plainExcerpt(opts.fallbackTitle),
    };
  }
  if (opts.blog) {
    return {
      imageUrl: firstImage(opts.blog.coverImage, opts.blog.ogImage),
      excerpt: plainExcerpt(opts.blog.excerpt) || plainExcerpt(opts.fallbackTitle),
    };
  }
  return { imageUrl: null, excerpt: plainExcerpt(opts.fallbackTitle) };
}

/** Pure SEO helpers — unit-testable without Nest */

export function buildRobotsMeta(opts: {
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  robotsNoArchive?: boolean;
  robotsNoSnippet?: boolean;
  maxSnippet?: number | null;
  maxImagePreview?: string;
  maxVideoPreview?: number | null;
}): string {
  const parts: string[] = [
    opts.robotsIndex === false ? 'noindex' : 'index',
    opts.robotsFollow === false ? 'nofollow' : 'follow',
  ];
  if (opts.robotsNoArchive) parts.push('noarchive');
  if (opts.robotsNoSnippet) parts.push('nosnippet');
  if (opts.maxSnippet != null) parts.push(`max-snippet:${opts.maxSnippet}`);
  if (opts.maxImagePreview) parts.push(`max-image-preview:${opts.maxImagePreview}`);
  if (opts.maxVideoPreview != null) parts.push(`max-video-preview:${opts.maxVideoPreview}`);
  return parts.join(',');
}

export function resolveCanonicalUrl(opts: {
  canonicalType?: string;
  canonicalUrl?: string | null;
  siteOrigin: string;
  path: string;
}): string | null {
  const type = opts.canonicalType || 'SELF';
  if (type === 'NONE') return null;
  if (type === 'CUSTOM' && opts.canonicalUrl) {
    const u = opts.canonicalUrl.trim();
    if (!/^https:\/\//i.test(u)) return null;
    return u.split('?')[0].replace(/\/$/, '') || u;
  }
  const origin = opts.siteOrigin.replace(/\/$/, '');
  const path = opts.path.startsWith('/') ? opts.path : `/${opts.path}`;
  return `${origin}${path}`;
}

export function countWords(text: string): number {
  const cleaned = (text || '')
    .replace(/[#*_`>\[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(' ').filter(Boolean).length;
}

export function estimateReadingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 180));
}

export function wouldCreateRedirectLoop(
  existing: Array<{ sourcePath: string; destinationUrl: string; isActive?: boolean }>,
  sourcePath: string,
  destinationUrl: string,
  channelOrigin: string,
): boolean {
  const normalizePath = (p: string) => {
    try {
      if (p.startsWith('http')) {
        const u = new URL(p);
        return u.pathname.replace(/\/$/, '') || '/';
      }
    } catch {
      /* ignore */
    }
    return (p.startsWith('/') ? p : `/${p}`).replace(/\/$/, '') || '/';
  };

  const destPath = normalizePath(destinationUrl);
  const src = normalizePath(sourcePath);
  if (src === destPath) return true;

  const map = new Map<string, string>();
  for (const r of existing) {
    if (r.isActive === false) continue;
    map.set(normalizePath(r.sourcePath), normalizePath(r.destinationUrl));
  }
  map.set(src, destPath);

  let cur = destPath;
  const seen = new Set<string>([src]);
  for (let i = 0; i < 20; i++) {
    if (seen.has(cur)) return true;
    seen.add(cur);
    const next = map.get(cur);
    if (!next) break;
    cur = next;
  }
  // unused but kept for signature clarity with callers that pass origin
  void channelOrigin;
  return false;
}

export function buildArticleJsonLd(opts: {
  schemaType?: string;
  title: string;
  description?: string;
  url: string;
  imageUrl?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  authorName?: string | null;
  authorUrl?: string | null;
  publisherName: string;
  publisherUrl: string;
  logoUrl: string;
  datePublished?: string | Date | null;
  dateModified?: string | Date | null;
}) {
  const type = opts.schemaType || 'BlogPosting';
  return {
    '@context': 'https://schema.org',
    '@type': type,
    headline: opts.title,
    description: opts.description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': opts.url },
    image: opts.imageUrl
      ? [
          {
            '@type': 'ImageObject',
            url: opts.imageUrl,
            width: opts.imageWidth || 1200,
            height: opts.imageHeight || 800,
          },
        ]
      : undefined,
    author: opts.authorName
      ? {
          '@type': 'Person',
          name: opts.authorName,
          ...(opts.authorUrl ? { url: opts.authorUrl } : {}),
        }
      : undefined,
    publisher: {
      '@type': 'Organization',
      name: opts.publisherName,
      url: opts.publisherUrl,
      logo: { '@type': 'ImageObject', url: opts.logoUrl },
    },
    datePublished: opts.datePublished
      ? new Date(opts.datePublished).toISOString()
      : undefined,
    dateModified: opts.dateModified
      ? new Date(opts.dateModified).toISOString()
      : opts.datePublished
        ? new Date(opts.datePublished).toISOString()
        : undefined,
    inLanguage: 'fa-IR',
  };
}

export function buildFaqJsonLd(
  items: Array<{ question: string; answer: string; isVisible?: boolean; includeInSchema?: boolean }>,
) {
  const visible = items.filter(
    (i) => i.isVisible !== false && i.includeInSchema !== false && i.question && i.answer,
  );
  if (!visible.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: visible.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// Server-side blog data access. Production never uses FALLBACK_POSTS.

export interface BlogFaqItem {
  id?: string;
  question: string;
  answer: string;
  sortOrder?: number;
  isVisible?: boolean;
  includeInSchema?: boolean;
}

export interface BlogPost {
  id: string | number;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  contentFormat?: string;
  category: string;
  categoryId?: string | null;
  channel?: string;
  publishedAt?: string;
  date?: string;
  views?: number;
  coverImage?: string | null;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  robotsNoArchive?: boolean;
  robotsNoSnippet?: boolean;
  maxImagePreview?: string;
  canonicalType?: string;
  canonicalUrl?: string | null;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string | null;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string | null;
  twitterCard?: string;
  schemaType?: string;
  breadcrumbEnabled?: boolean;
  articleSchemaEnabled?: boolean;
  faqSchemaEnabled?: boolean;
  faqItems?: BlogFaqItem[] | null;
  primaryCta?: {
    title: string;
    description?: string;
    buttonText: string;
    buttonUrl: string;
    openInNewTab?: boolean;
  } | null;
  readingTimeMinutes?: number;
  wordCount?: number;
  authorName?: string | null;
  tags?: string[];
  updatedAt?: string;
  sitemapPriority?: number;
  sitemapChangeFrequency?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
const allowFallback =
  process.env.NODE_ENV !== 'production' && process.env.BLOG_ALLOW_FALLBACK === '1';

export const CATEGORY_COLORS: Record<string, string> = {
  'راهنمای پارچه': 'bg-emerald-50 text-emerald-700',
  'راهنمای کسب‌وکار': 'bg-blue-50 text-blue-700',
  'ترند فصلی': 'bg-pink-50 text-pink-700',
  'مدیریت بوتیک': 'bg-amber-50 text-amber-700',
  'عمومی': 'bg-gray-50 text-gray-600',
  'راهنمای خرید مانتو': 'bg-violet-50 text-violet-700',
  'استایل زنانه': 'bg-rose-50 text-rose-700',
  'نگهداری لباس': 'bg-teal-50 text-teal-700',
};

export function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['عمومی'];
}

export function formatJalali(post: BlogPost): string {
  if (post.date) return post.date;
  if (post.publishedAt) return new Date(post.publishedAt).toLocaleDateString('fa-IR');
  return '';
}

export function readTime(post: BlogPost): string {
  if (post.readingTimeMinutes && post.readingTimeMinutes > 0) {
    return `${post.readingTimeMinutes.toLocaleString('fa-IR')} دقیقه`;
  }
  const words = (post.content ?? post.excerpt ?? '').split(/\s+/).filter(Boolean).length;
  const mins = Math.max(2, Math.round(words / 180));
  return `${mins.toLocaleString('fa-IR')} دقیقه`;
}

export function buildRobotsContent(post: BlogPost): string {
  const parts = [
    post.robotsIndex === false ? 'noindex' : 'index',
    post.robotsFollow === false ? 'nofollow' : 'follow',
  ];
  if (post.robotsNoArchive) parts.push('noarchive');
  if (post.robotsNoSnippet) parts.push('nosnippet');
  if (post.maxImagePreview) parts.push(`max-image-preview:${post.maxImagePreview}`);
  return parts.join(',');
}

/** Dev-only seed; never used in production. */
export const FALLBACK_POSTS: BlogPost[] = [
  {
    id: 1,
    slug: 'linen-vs-cotton',
    title: 'تفاوت لینن و کتان در مانتو زنانه — کدام را انتخاب کنیم؟',
    excerpt:
      'لینن و کتان هر دو پارچه‌های طبیعی هستند، اما تفاوت‌های مهمی در احساس پوشش، تنفس‌پذیری و نگهداری دارند.',
    content: '## تنفس‌پذیری\n\nلینن تنفس‌پذیرترین پارچه طبیعی است.',
    category: 'راهنمای پارچه',
    date: '۱۴۰۳/۰۴/۱۰',
  },
];

export async function fetchPosts(opts?: {
  channel?: 'WHOLESALE' | 'RETAIL';
  limit?: number;
  page?: number;
  category?: string;
  search?: string;
}): Promise<{ posts: BlogPost[]; fromApi: boolean; meta?: { total: number; page: number; totalPages: number } }> {
  const channel = opts?.channel ?? 'WHOLESALE';
  const limit = opts?.limit ?? 12;
  const page = opts?.page ?? 1;
  const params = new URLSearchParams({
    channel,
    limit: String(limit),
    page: String(page),
  });
  if (opts?.category) params.set('category', opts.category);
  if (opts?.search) params.set('search', opts.search);

  try {
    const res = await fetch(`${API_URL}/blog/posts?${params}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error('blog fetch failed');
    const json = await res.json();
    const items = Array.isArray(json.items) ? json.items : Array.isArray(json.data) ? json.data : [];
    if (items.length > 0 || !allowFallback) {
      return {
        posts: items,
        fromApi: true,
        meta: json.meta,
      };
    }
  } catch {
    /* fall through */
  }
  if (allowFallback) return { posts: FALLBACK_POSTS, fromApi: false };
  return { posts: [], fromApi: false };
}

export async function fetchPost(
  slug: string,
  channel: 'WHOLESALE' | 'RETAIL' = 'WHOLESALE',
): Promise<BlogPost | null> {
  try {
    const res = await fetch(
      `${API_URL}/blog/posts/${encodeURIComponent(slug)}?channel=${channel}`,
      { next: { revalidate: 300 } },
    );
    if (res.ok) return await res.json();
  } catch {
    /* fall through */
  }
  if (allowFallback) return FALLBACK_POSTS.find((p) => p.slug === slug) ?? null;
  return null;
}

export async function fetchSitemapPosts(channel: 'WHOLESALE' | 'RETAIL'): Promise<BlogPost[]> {
  try {
    const res = await fetch(`${API_URL}/blog/sitemap-posts?channel=${channel}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

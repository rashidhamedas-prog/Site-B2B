/** SEO analysis engine — advisory only (blocks only on critical errors). */

export type SEOCheckSeverity = 'error' | 'warning' | 'passed';

export interface SEOCheck {
  id: string;
  label: string;
  severity: SEOCheckSeverity;
  detail?: string;
}

export interface SEOAnalysisResult {
  score: number;
  status: 'POOR' | 'NEEDS_IMPROVEMENT' | 'GOOD' | 'EXCELLENT';
  errors: SEOCheck[];
  warnings: SEOCheck[];
  passed: SEOCheck[];
}

export interface SEOAnalysisInput {
  title?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  slug?: string | null;
  content?: string | null;
  excerpt?: string | null;
  coverImage?: string | null;
  coverAlt?: string | null;
  faqItems?: Array<{ question?: string; answer?: string }> | null;
  primaryCta?: { buttonUrl?: string } | null;
  relatedArticleIds?: string[] | null;
  relatedProductIds?: string[] | null;
  authorName?: string | null;
  publishedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  canonicalType?: string | null;
  robotsIndex?: boolean | null;
  ogTitle?: string | null;
  ogImage?: string | null;
  articleSchemaEnabled?: boolean | null;
  breadcrumbEnabled?: boolean | null;
}

const TITLE_MIN = 45;
const TITLE_MAX = 60;
const META_MIN = 120;
const META_MAX = 160;
const MIN_WORDS = 300;

function stripMd(text: string): string {
  return (text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_`>\[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHeadings(content: string): { level: number; text: string }[] {
  const lines = (content || '').split(/\n/);
  const out: { level: number; text: string }[] = [];
  for (const line of lines) {
    const m = /^(#{2,6})\s+(.+)$/.exec(line.trim());
    if (m) out.push({ level: m[1].length, text: m[2].trim() });
  }
  return out;
}

function includesKeyword(hay: string, keyword: string): boolean {
  if (!keyword) return false;
  return hay.toLowerCase().includes(keyword.toLowerCase());
}

function keywordDensity(content: string, keyword: string): number {
  if (!keyword) return 0;
  const words = stripMd(content).split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const kw = keyword.toLowerCase();
  const hits = words.filter((w) => w.toLowerCase().includes(kw)).length;
  return hits / words.length;
}

export function analyzeSeo(input: SEOAnalysisInput): SEOAnalysisResult {
  const errors: SEOCheck[] = [];
  const warnings: SEOCheck[] = [];
  const passed: SEOCheck[] = [];

  const push = (check: SEOCheck) => {
    if (check.severity === 'error') errors.push(check);
    else if (check.severity === 'warning') warnings.push(check);
    else passed.push(check);
  };

  const title = (input.title || '').trim();
  const seoTitle = (input.seoTitle || title).trim();
  const meta = (input.metaDescription || input.excerpt || '').trim();
  const keyword = (input.focusKeyword || '').trim();
  const content = input.content || '';
  const plain = stripMd(content);
  const words = plain.split(/\s+/).filter(Boolean).length;
  const headings = extractHeadings(content);
  const h2s = headings.filter((h) => h.level === 2);
  const intro = plain.slice(0, 300);

  push(
    title
      ? { id: 'title', label: 'عنوان مقاله', severity: 'passed' }
      : { id: 'title', label: 'عنوان مقاله', severity: 'error', detail: 'عنوان خالی است' },
  );

  push(
    seoTitle
      ? { id: 'seo_title', label: 'SEO Title', severity: 'passed' }
      : { id: 'seo_title', label: 'SEO Title', severity: 'error', detail: 'عنوان سئو خالی است' },
  );

  if (seoTitle) {
    if (seoTitle.length < TITLE_MIN || seoTitle.length > TITLE_MAX) {
      push({
        id: 'seo_title_len',
        label: 'طول SEO Title',
        severity: 'warning',
        detail: `پیشنهاد ${TITLE_MIN}–${TITLE_MAX} کاراکتر (الان ${seoTitle.length})`,
      });
    } else {
      push({ id: 'seo_title_len', label: 'طول SEO Title', severity: 'passed' });
    }
  }

  push(
    meta
      ? { id: 'meta', label: 'Meta Description', severity: 'passed' }
      : { id: 'meta', label: 'Meta Description', severity: 'error', detail: 'توضیحات متا خالی است' },
  );

  if (meta) {
    if (meta.length < META_MIN || meta.length > META_MAX) {
      push({
        id: 'meta_len',
        label: 'طول Meta Description',
        severity: 'warning',
        detail: `پیشنهاد ${META_MIN}–${META_MAX} کاراکتر (الان ${meta.length})`,
      });
    } else {
      push({ id: 'meta_len', label: 'طول Meta Description', severity: 'passed' });
    }
  }

  push(
    keyword
      ? { id: 'focus', label: 'Focus Keyword', severity: 'passed' }
      : { id: 'focus', label: 'Focus Keyword', severity: 'warning', detail: 'کلمه کلیدی اصلی ثبت نشده' },
  );

  if (keyword) {
    push(
      includesKeyword(title, keyword) || includesKeyword(seoTitle, keyword)
        ? { id: 'kw_title', label: 'کلمه کلیدی در عنوان', severity: 'passed' }
        : { id: 'kw_title', label: 'کلمه کلیدی در عنوان', severity: 'warning' },
    );
    push(
      includesKeyword(intro, keyword)
        ? { id: 'kw_intro', label: 'کلمه کلیدی در مقدمه', severity: 'passed' }
        : { id: 'kw_intro', label: 'کلمه کلیدی در مقدمه', severity: 'warning' },
    );
    push(
      h2s.some((h) => includesKeyword(h.text, keyword))
        ? { id: 'kw_h2', label: 'کلمه کلیدی در H2', severity: 'passed' }
        : { id: 'kw_h2', label: 'کلمه کلیدی در H2', severity: 'warning' },
    );
    push(
      includesKeyword(input.slug || '', keyword.replace(/\s+/g, '-')) ||
        includesKeyword(input.slug || '', keyword)
        ? { id: 'kw_slug', label: 'کلمه کلیدی در اسلاگ', severity: 'passed' }
        : { id: 'kw_slug', label: 'کلمه کلیدی در اسلاگ', severity: 'warning' },
    );
    const density = keywordDensity(content, keyword);
    if (density > 0.06) {
      push({
        id: 'kw_stuffing',
        label: 'استفاده بیش از حد از کلمه کلیدی',
        severity: 'warning',
        detail: 'چگالی بالا به نظر می‌رسد؛ از Keyword Stuffing پرهیز کنید',
      });
    } else {
      push({ id: 'kw_stuffing', label: 'چگالی طبیعی کلمه کلیدی', severity: 'passed' });
    }
  }

  if (words < MIN_WORDS) {
    push({
      id: 'words',
      label: 'تعداد کلمات',
      severity: 'warning',
      detail: `${words} کلمه — پیشنهاد حداقل حدود ${MIN_WORDS}`,
    });
  } else {
    push({ id: 'words', label: 'تعداد کلمات', severity: 'passed', detail: `${words} کلمه` });
  }

  push(
    input.coverImage
      ? { id: 'cover', label: 'تصویر شاخص', severity: 'passed' }
      : { id: 'cover', label: 'تصویر شاخص', severity: 'warning' },
  );

  if (input.coverImage) {
    push(
      input.coverAlt
        ? { id: 'cover_alt', label: 'Alt تصویر شاخص', severity: 'passed' }
        : { id: 'cover_alt', label: 'Alt تصویر شاخص', severity: 'warning' },
    );
  }

  push(
    h2s.length > 0
      ? { id: 'h2', label: 'وجود H2', severity: 'passed' }
      : { id: 'h2', label: 'وجود H2', severity: 'warning' },
  );

  let headingOrderOk = true;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) headingOrderOk = false;
  }
  push(
    headingOrderOk
      ? { id: 'heading_order', label: 'ترتیب Headingها', severity: 'passed' }
      : { id: 'heading_order', label: 'ترتیب Headingها', severity: 'warning' },
  );

  const longParas = (content || '').split(/\n\n+/).filter((p) => stripMd(p).split(/\s+/).length > 150);
  push(
    longParas.length
      ? { id: 'long_para', label: 'پاراگراف‌های خیلی بلند', severity: 'warning', detail: `${longParas.length} پاراگراف` }
      : { id: 'long_para', label: 'طول پاراگراف‌ها', severity: 'passed' },
  );

  push(
    faqVisibleEnough(input.faqItems)
      ? { id: 'faq', label: 'وجود FAQ', severity: 'passed' }
      : { id: 'faq', label: 'وجود FAQ', severity: 'warning' },
  );

  push(
    input.primaryCta?.buttonUrl
      ? { id: 'cta', label: 'وجود CTA', severity: 'passed' }
      : { id: 'cta', label: 'وجود CTA', severity: 'warning' },
  );

  push(
    input.canonicalType && input.canonicalType !== 'NONE'
      ? { id: 'canonical', label: 'Canonical', severity: 'passed' }
      : { id: 'canonical', label: 'Canonical', severity: 'warning' },
  );

  push(
    input.robotsIndex !== false
      ? { id: 'robots', label: 'Robots Index', severity: 'passed' }
      : { id: 'robots', label: 'Robots Index', severity: 'warning', detail: 'noindex فعال است' },
  );

  push(
    input.ogTitle || seoTitle
      ? { id: 'og', label: 'Open Graph', severity: 'passed' }
      : { id: 'og', label: 'Open Graph', severity: 'warning' },
  );

  push(
    input.articleSchemaEnabled !== false
      ? { id: 'schema', label: 'Article Schema', severity: 'passed' }
      : { id: 'schema', label: 'Article Schema', severity: 'warning' },
  );

  push(
    input.breadcrumbEnabled !== false
      ? { id: 'breadcrumb', label: 'Breadcrumb Schema', severity: 'passed' }
      : { id: 'breadcrumb', label: 'Breadcrumb Schema', severity: 'warning' },
  );

  push(
    input.authorName
      ? { id: 'author', label: 'نویسنده', severity: 'passed' }
      : { id: 'author', label: 'نویسنده', severity: 'warning' },
  );

  push(
    input.publishedAt
      ? { id: 'published', label: 'تاریخ انتشار', severity: 'passed' }
      : { id: 'published', label: 'تاریخ انتشار', severity: 'warning' },
  );

  push(
    (input.relatedArticleIds || []).length > 0
      ? { id: 'related_articles', label: 'مقالات مرتبط', severity: 'passed' }
      : { id: 'related_articles', label: 'مقالات مرتبط', severity: 'warning' },
  );

  push(
    (input.relatedProductIds || []).length > 0
      ? { id: 'related_products', label: 'محصولات مرتبط', severity: 'passed' }
      : { id: 'related_products', label: 'محصولات مرتبط', severity: 'warning' },
  );

  const total = errors.length + warnings.length + passed.length || 1;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(((passed.length * 1 + warnings.length * 0.45) / total) * 100 - errors.length * 12),
    ),
  );

  let status: SEOAnalysisResult['status'] = 'POOR';
  if (score >= 85) status = 'EXCELLENT';
  else if (score >= 70) status = 'GOOD';
  else if (score >= 45) status = 'NEEDS_IMPROVEMENT';

  return { score, status, errors, warnings, passed };
}

function faqVisibleEnough(
  items?: Array<{ question?: string; answer?: string }> | null,
): boolean {
  return (items || []).some((i) => i.question && i.answer);
}

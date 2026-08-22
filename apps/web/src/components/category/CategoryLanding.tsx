import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import {
  BreadcrumbJsonLd,
  CollectionPageJsonLd,
  FaqJsonLd,
} from '@/components/shared/JsonLd';
import { getCategoryCanonicalUrl, siteOrigin, type PublicSite } from '@/lib/canonical-urls';
import { mediaUrl, uniqueByColor, uniqueSizes } from '@/lib/product-display';
import { RetailProductCard } from '@/components/retail/RetailProductCard';
import { getServerApiBase } from '@/lib/server-api';
import { redirectIfMatched } from '@/lib/seo-redirect';

export type CategoryChannel = 'RETAIL' | 'WHOLESALE';

export type CategorySearchParams = {
  q?: string;
  search?: string;
  fabric?: string;
  color?: string;
  size?: string;
  collar?: string;
  collectionId?: string;
  minPrice?: string;
  maxPrice?: string;
  page?: string;
  sort?: string;
};

export type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  h1?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  introText?: string | null;
  bottomContent?: string | null;
  heroImage?: string | null;
  heroImageAlt?: string | null;
  ogImage?: string | null;
  isIndexable?: boolean;
  status?: string;
  faqItems?: Array<{ question: string; answer: string }> | null;
  wholesaleH1?: string | null;
  wholesaleSeoTitle?: string | null;
  wholesaleSeoDescription?: string | null;
  wholesaleIntroText?: string | null;
  wholesaleBottomContent?: string | null;
};

type CategoryProduct = {
  id?: string;
  name?: string;
  slug?: string;
  fabric?: string;
  retailPrice?: number | null;
  wholesalePrice?: number | null;
  sale?: {
    active?: boolean;
    payable?: number;
    original?: number | null;
    badgePercent?: number;
  };
  images?: string[];
  variants?: Array<{ color?: string; colorHex?: string; size?: string }>;
};

type ProductListResult = {
  data: CategoryProduct[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

const FILTER_KEYS: Array<keyof CategorySearchParams> = [
  'q',
  'search',
  'fabric',
  'color',
  'size',
  'collar',
  'collectionId',
  'minPrice',
  'maxPrice',
  'page',
  'sort',
];

function siteOf(channel: CategoryChannel): PublicSite {
  return channel === 'RETAIL' ? 'retail' : 'wholesale';
}

function safeHtml(html: string): string {
  return (html || '')
    .replace(/<\/?(?:script|iframe|object|embed|form|link|meta|base)[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi, '');
}

function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

export function hasCategoryFilters(params: CategorySearchParams): boolean {
  return FILTER_KEYS.some((key) => Boolean(params[key]));
}

export const fetchCategoryBySlug = cache(async (slug: string): Promise<CategoryRecord | null> => {
  try {
    const res = await fetch(
      `${getServerApiBase()}/categories/slug/${encodeURIComponent(slug)}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as CategoryRecord;
  } catch {
    return null;
  }
});

export const fetchPublicCategories = cache(async (): Promise<CategoryRecord[]> => {
  try {
    const res = await fetch(`${getServerApiBase()}/categories`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rows = Array.isArray(json) ? json : json.data ?? [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
});

async function fetchCategoryProducts(
  channel: CategoryChannel,
  slug: string,
  params: CategorySearchParams,
): Promise<ProductListResult> {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = 24;
  const empty: ProductListResult = { data: [], meta: { page, limit, total: 0, totalPages: 1 } };
  try {
    const qs = new URLSearchParams({
      channel,
      categorySlug: slug,
      limit: String(limit),
      page: String(page),
      status: 'ACTIVE',
    });
    if (params.q || params.search) qs.set('q', String(params.q || params.search));
    if (params.fabric) qs.set('fabric', params.fabric);
    if (params.color) qs.set('color', params.color);
    if (params.size) qs.set('size', params.size);
    if (params.collar) qs.set('collar', params.collar);
    if (params.collectionId) qs.set('collectionId', params.collectionId);
    if (params.minPrice) qs.set('minPrice', params.minPrice);
    if (params.maxPrice) qs.set('maxPrice', params.maxPrice);
    if (params.sort) qs.set('sort', params.sort);
    if (channel === 'WHOLESALE') qs.set('includeVariants', '1');

    const res = await fetch(`${getServerApiBase()}/products?${qs}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return empty;
    const json = (await res.json()) as { data?: CategoryProduct[]; meta?: ProductListResult['meta'] } | CategoryProduct[];
    if (Array.isArray(json)) {
      return { data: json, meta: { page, limit, total: json.length, totalPages: 1 } };
    }
    const data = Array.isArray(json.data) ? json.data : [];
    return {
      data,
      meta: {
        page: json.meta?.page ?? page,
        limit: json.meta?.limit ?? limit,
        total: json.meta?.total ?? data.length,
        totalPages: json.meta?.totalPages ?? 1,
      },
    };
  } catch {
    return empty;
  }
}

function copyFor(category: CategoryRecord, channel: CategoryChannel) {
  const name = category.name || 'دسته‌بندی';
  if (channel === 'RETAIL') {
    return {
      h1: category.h1 || `خرید ${name} زنانه`,
      title: category.seoTitle || `خرید ${name} زنانه | پوشاک ترنم`,
      description:
        category.seoDescription ||
        `خرید ${name} زنانه مستقیم از تولیدی ترنم؛ مدل‌های اسپرت با رنگ‌بندی و سایزبندی متنوع.`,
      intro: category.introText || '',
      bottom: category.bottomContent || '',
    };
  }
  return {
    h1: category.wholesaleH1 || `خرید عمده ${name} زنانه`,
    title: category.wholesaleSeoTitle || `خرید عمده ${name} زنانه | تولیدی ترنم مشهد`,
    description:
      category.wholesaleSeoDescription ||
      `خرید عمده ${name} زنانه مستقیم از تولیدی ترنم مشهد؛ مناسب بوتیک‌ها و فروشندگان سراسر ایران.`,
    intro: category.wholesaleIntroText || '',
    bottom: category.wholesaleBottomContent || '',
  };
}

export async function categoryLandingMetadata(
  channel: CategoryChannel,
  slug: string,
  params: CategorySearchParams,
): Promise<Metadata> {
  const category = await fetchCategoryBySlug(slug);
  if (!category) {
    await redirectIfMatched(channel, `/category/${slug}`);
    return { title: 'دسته‌بندی یافت نشد', robots: { index: false, follow: false } };
  }
  const copy = copyFor(category, channel);
  const canonical = getCategoryCanonicalUrl(category.slug, siteOf(channel));
  const filtered = hasCategoryFilters(params) || category.isIndexable === false;
  const og = mediaUrl(category.ogImage || category.heroImage);
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical },
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: canonical,
      type: 'website',
      locale: 'fa_IR',
      ...(og ? { images: [{ url: og }] } : {}),
    },
  };
}

function RichText({
  value,
  className,
}: {
  value: string;
  className: string;
}) {
  const text = value.trim();
  if (!text) return null;
  if (looksLikeHtml(text)) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: safeHtml(text) }}
      />
    );
  }
  return (
    <div className={className}>
      {text.split(/\n\n+/).map((para, i) => (
        <p key={i} className="mb-3 last:mb-0">
          {para}
        </p>
      ))}
    </div>
  );
}

function queryString(params: CategorySearchParams, page?: number): string {
  const qs = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (key === 'page') continue;
    const value = params[key];
    if (value) qs.set(key, value);
  }
  if (page && page > 1) qs.set('page', String(page));
  const raw = qs.toString();
  return raw ? `?${raw}` : '';
}

function CategoryProductCard({
  product,
  channel,
}: {
  product: CategoryProduct;
  channel: CategoryChannel;
}) {
  const href = `/products/${product.slug}`;
  const image = mediaUrl(product.images?.[0]);
  const variants = product.variants ?? [];
  const colors = uniqueByColor(variants);
  const sizes = uniqueSizes(variants);
  const retail = channel === 'RETAIL';

  if (retail && product.id && product.slug) {
    return (
      <RetailProductCard
        compact
        product={{
          id: product.id,
          name: product.name || '',
          slug: product.slug,
          fabric: product.fabric,
          retailPrice: product.retailPrice,
          images: product.images,
          sale: product.sale,
          variants: product.variants,
        }}
      />
    );
  }

  return (
    <article className="group overflow-hidden rounded-lg border border-[var(--brand-border,#E8E0D4)] bg-[var(--brand-ivory,#F6F1E8)]">
      <Link href={href} className="relative block aspect-[3/4] overflow-hidden bg-[var(--brand-card,#F3EEE6)]">
        {image ? (
          <Image
            src={image}
            alt={product.name || 'محصول'}
            fill
            sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--brand-muted,#6B7280)]">
            بدون تصویر
          </div>
        )}
      </Link>
      <div className="p-3.5 sm:p-4">
        <Link href={href} className="block text-sm font-bold leading-6 text-[var(--brand-ink,#1A1A1A)]">
          {product.name}
        </Link>
        {product.fabric ? (
          <p className="mt-1 text-xs text-[var(--brand-muted,#6B7280)]">{product.fabric}</p>
        ) : null}
        {(colors.length || sizes.length) ? (
          <div className="mt-2 space-y-1.5 text-xs text-[var(--brand-muted,#6B7280)]">
            {colors.length ? (
              <p>
                رنگ‌ها:{' '}
                {colors
                  .map((c) => c.color)
                  .filter(Boolean)
                  .slice(0, 6)
                  .join('، ')}
              </p>
            ) : null}
            {sizes.length ? <p>سایزها: {sizes.slice(0, 8).join('، ')}</p> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export async function CategoryLanding({
  channel,
  slug,
  searchParams,
}: {
  channel: CategoryChannel;
  slug: string;
  searchParams: CategorySearchParams;
}) {
  const [category, siblings] = await Promise.all([
    fetchCategoryBySlug(slug),
    fetchPublicCategories(),
  ]);
  if (!category?.slug) {
    await redirectIfMatched(channel, `/category/${slug}`);
    notFound();
  }

  const listing = await fetchCategoryProducts(channel, category.slug, searchParams);
  const products = listing.data.filter((p) => p.slug);
  const copy = copyFor(category, channel);
  const site = siteOf(channel);
  const origin = siteOrigin(site);
  const canonical = getCategoryCanonicalUrl(category.slug, site);
  const hero = mediaUrl(category.heroImage);
  const faq = (category.faqItems || []).filter((item) => item.question && item.answer);
  const siblingLinks = siblings
    .filter(
      (row) =>
        row.slug &&
        row.slug !== category.slug &&
        row.isIndexable !== false &&
        String(row.status || 'ACTIVE').toUpperCase() !== 'HIDDEN',
    )
    .slice(0, 12);
  const page = listing.meta.page || 1;
  const totalPages = listing.meta.totalPages || 1;
  const retail = channel === 'RETAIL';

  return (
    <>
      <CollectionPageJsonLd
        name={copy.h1}
        description={copy.description}
        url={canonical}
        items={products.map((product) => ({
          name: String(product.name || product.slug),
          url: `${origin}/products/${product.slug}`,
        }))}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'خانه', url: `${origin}/` },
          { name: 'دسته‌بندی‌ها', url: `${origin}/products` },
          { name: category.name, url: canonical },
        ]}
      />
      {faq.length ? <FaqJsonLd items={faq} /> : null}

      <div className={retail ? 'bg-[var(--retail-bg,#F6F1E8)]' : 'bg-[var(--brand-ivory,#F6F1E8)]'}>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <nav className="mb-6 text-xs text-[var(--brand-muted,#6B7280)]" aria-label="مسیر صفحه">
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <Link href="/" className="hover:text-[var(--brand-green,#1B5C4A)]">
                  خانه
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href="/products" className="hover:text-[var(--brand-green,#1B5C4A)]">
                  دسته‌بندی‌ها
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-medium text-[var(--brand-ink,#1A1A1A)]">{category.name}</li>
            </ol>
          </nav>

          {hero ? (
            <div className="relative mb-8 aspect-[21/9] overflow-hidden rounded-3xl bg-[var(--brand-card,#F3EEE6)]">
              <Image
                src={hero}
                alt={category.heroImageAlt || copy.h1}
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </div>
          ) : null}

          <header className="max-w-3xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--brand-green-dark,#0F2F28)] sm:text-4xl">
              {copy.h1}
            </h1>
            {copy.intro ? (
              <RichText
                value={copy.intro}
                className="mt-4 text-sm leading-8 text-[var(--brand-muted,#6B7280)] [&_a]:text-[var(--brand-green,#1B5C4A)] [&_p]:mb-3"
              />
            ) : null}
          </header>

          {products.length ? (
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {products.map((product) => (
                <CategoryProductCard
                  key={product.slug}
                  product={product}
                  channel={channel}
                />
              ))}
            </div>
          ) : (
            <p className="mt-10 text-sm text-[var(--brand-muted,#6B7280)]">
              محصولی در این دسته منتشر نشده است.
            </p>
          )}

          {totalPages > 1 ? (
            <nav className="mt-10 flex items-center justify-center gap-3 text-sm" aria-label="صفحه‌بندی">
              {page > 1 ? (
                <Link
                  href={`/category/${category.slug}${queryString(searchParams, page - 1)}`}
                  className="rounded-full border border-[var(--brand-border,#E8E0D4)] px-4 py-2"
                >
                  قبلی
                </Link>
              ) : null}
              <span>
                صفحه {page} از {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={`/category/${category.slug}${queryString(searchParams, page + 1)}`}
                  className="rounded-full border border-[var(--brand-border,#E8E0D4)] px-4 py-2"
                >
                  بعدی
                </Link>
              ) : null}
            </nav>
          ) : null}

          {copy.bottom ? (
            <RichText
              value={copy.bottom}
              className="mx-auto mt-14 max-w-3xl text-sm leading-8 text-[var(--brand-muted,#6B7280)] [&_a]:text-[var(--brand-green,#1B5C4A)] [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[var(--brand-green-dark,#0F2F28)] [&_p]:mb-3"
            />
          ) : null}

          {faq.length ? (
            <section className="mx-auto mt-14 max-w-3xl">
              <h2 className="text-xl font-bold text-[var(--brand-green-dark,#0F2F28)]">سوالات متداول</h2>
              <dl className="mt-6 space-y-4">
                {faq.map((item) => (
                  <div key={item.question} className="rounded-2xl bg-white/70 p-5 ring-1 ring-[var(--brand-border,#E8E0D4)]">
                    <dt className="font-bold text-[var(--brand-ink,#1A1A1A)]">{item.question}</dt>
                    <dd className="mt-2 text-sm leading-7 text-[var(--brand-muted,#6B7280)]">{item.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {siblingLinks.length ? (
            <section className="mt-14">
              <h2 className="text-lg font-bold text-[var(--brand-green-dark,#0F2F28)]">دسته‌های مرتبط</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {siblingLinks.map((row) => (
                  <li key={row.slug}>
                    <Link
                      href={`/category/${row.slug}`}
                      className="inline-flex rounded-full border border-[var(--brand-border,#E8E0D4)] bg-white px-4 py-2 text-sm text-[var(--brand-green-dark,#0F2F28)] transition hover:border-[var(--brand-gold,#C9A84C)]"
                    >
                      {row.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}

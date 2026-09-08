import Link from 'next/link';
import { slimRetailCatalogProduct } from '@/lib/server-api';
import { fetchProductsBlockCatalog } from '@/lib/cms/fetch-products-block';
import { RetailProductCard, type RetailCardProduct } from './RetailProductCard';

/** SSR product grid for retail home — compact editorial cards, no client waterfall. */
export async function RetailProductGrid({
  props = {},
}: {
  props?: Record<string, unknown>;
}) {
  const { query, products: raw, error } = await fetchProductsBlockCatalog('RETAIL', props);
  if (!query.enabled) return null;
  const products = raw.map((row) => slimRetailCatalogProduct(row)) as RetailCardProduct[];

  return (
    <section className="relative overflow-hidden bg-[var(--retail-bg)] py-14 sm:py-20">
      <svg
        className="pointer-events-none absolute -left-6 top-10 hidden h-64 w-40 text-[var(--retail-gold)] opacity-40 lg:block"
        viewBox="0 0 120 220"
        fill="none"
        aria-hidden
      >
        <path
          d="M40 210 C20 160 70 140 35 100 C10 70 55 50 40 10"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path d="M40 100 C55 90 70 105 58 120" stroke="currentColor" strokeWidth="1" />
        <path d="M35 60 C50 48 68 62 52 78" stroke="currentColor" strokeWidth="1" />
        <circle cx="40" cy="10" r="3" fill="currentColor" opacity="0.5" />
      </svg>

      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col items-center gap-4 text-center sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:text-right">
          <div>
            {query.eyebrow ? (
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[var(--retail-gold)]">{query.eyebrow}</p>
            ) : (
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[var(--retail-gold)]">COLLECTION</p>
            )}
            {query.headline ? (
              <h2 className="mt-2 text-2xl font-extrabold text-[var(--retail-ink)] sm:text-3xl">{query.headline}</h2>
            ) : null}
            {query.body ? (
              <p className="mt-2 max-w-xl text-sm text-[var(--retail-ink)]/70">{query.body}</p>
            ) : null}
          </div>
          {query.ctaLabel && query.ctaHref ? (
            <Link
              href={query.ctaHref}
              className="inline-flex min-h-11 cursor-pointer items-center border-b border-[var(--retail-gold)] pb-0.5 text-sm font-bold text-[var(--retail-primary)]"
            >
              {query.ctaLabel}
            </Link>
          ) : null}
        </div>

        {products.length === 0 ? (
          <div className="rounded-lg border border-[var(--retail-border)] bg-[var(--retail-card)] px-6 py-16 text-center" role="status">
            <p className="text-[var(--retail-ink)]">
              {error ? 'بارگذاری محصولات با خطا مواجه شد. لطفاً بعداً دوباره تلاش کنید.' : 'هنوز محصولی برای نمایش نیست.'}
            </p>
            {query.ctaHref ? (
              <Link
                href={query.ctaHref}
                className="mt-4 inline-flex cursor-pointer border-b border-[var(--retail-gold)] pb-0.5 text-sm font-bold text-[var(--retail-primary)]"
              >
                {query.ctaLabel}
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4 md:gap-6">
            {products.map((p) => (
              <RetailProductCard key={p.id} product={p} compact />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

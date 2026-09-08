import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';
import { slimWholesaleCatalogProduct } from '@/lib/slim-wholesale-catalog';
import { fetchProductsBlockCatalog } from '@/lib/cms/fetch-products-block';
import { WholesaleProductCard, type WholesaleCardProduct } from './WholesaleProductCard';

export async function FeaturedProducts({
  props = {},
}: {
  props?: Record<string, unknown>;
} = {}) {
  const { query, products: raw, error } = await fetchProductsBlockCatalog('WHOLESALE', props);
  if (!query.enabled) return null;
  const items = raw.map((row) => slimWholesaleCatalogProduct(row) as WholesaleCardProduct);
  if (!items.length) {
    if (query.hideWhenEmpty && !error) return null;
    return (
      <section className="section bg-white">
        <div className="container-site">
          <p className="rounded-xl border border-[color:var(--color-border)] bg-surface-muted px-6 py-10 text-center text-sm text-gray-600" role="status">
            {error ? 'بارگذاری محصولات با خطا مواجه شد. لطفاً بعداً دوباره تلاش کنید.' : 'هنوز محصولی برای نمایش نیست.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="section bg-white">
      <div className="container-site">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            {query.eyebrow ? (
              <p className="mb-2 text-sm font-semibold tracking-wide text-secondary-dark">{query.eyebrow}</p>
            ) : null}
            {query.headline ? <h2 className="section-title mb-2">{query.headline}</h2> : null}
            {query.body ? <p className="section-subtitle mb-0">{query.body}</p> : null}
          </div>
          {query.ctaLabel && query.ctaHref ? (
            <Link href={query.ctaHref} className="hidden flex-shrink-0 cursor-pointer sm:block">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4 rtl-flip" />}>
                {query.ctaLabel}
              </Button>
            </Link>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-5">
          {items.map((product) => (
            <WholesaleProductCard key={product.id} product={product} />
          ))}
        </div>

        {query.showPortalCta ? (
          <div className="mt-12 border border-[color:var(--color-border)] bg-surface-muted px-6 py-8 text-center sm:rounded-2xl">
            <p className="mb-4 text-sm font-medium text-gray-700">{query.portalBody}</p>
            <div className="flex items-center justify-center gap-3">
              <Link href={query.portalLoginHref} className="cursor-pointer">
                <Button variant="primary" size="sm">
                  {query.portalLoginLabel}
                </Button>
              </Link>
              <Link href={query.portalRegisterHref} className="cursor-pointer">
                <Button variant="outline" size="sm">
                  {query.portalRegisterLabel}
                </Button>
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

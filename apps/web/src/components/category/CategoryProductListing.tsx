import { CategoryProductCard } from './CategoryProductCard';
import { CategoryListBeacon } from './CategoryListBeacon';
import {
  categoryPageQuery,
  type CategoryChannel,
  type CategoryProductListResult,
  type CategorySearchParams,
} from './category-search-params';

export function CategoryProductListing({
  channel,
  slug,
  listing,
  searchParams,
}: {
  channel: CategoryChannel;
  slug: string;
  listing: CategoryProductListResult;
  searchParams: CategorySearchParams;
}) {
  const products = listing.data.filter((product) => product.slug);
  const page = listing.meta.page || 1;
  const totalPages = listing.meta.totalPages || 1;

  return (
    <>
      <CategoryListBeacon
        channel={channel}
        slug={slug}
        items={products.map((product) => ({
          productId: product.id,
          name: product.name || product.slug || '',
          unitPrice: Number(product.sale?.payable ?? product.retailPrice ?? 0),
          quantity: 1,
          itemListId: `/category/${slug}`,
          itemListName: 'category',
        }))}
      />
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
            <a
              href={`/category/${slug}${categoryPageQuery(searchParams, page - 1)}`}
              className="rounded-full border border-[var(--brand-border,#E8E0D4)] px-4 py-2"
            >
              قبلی
            </a>
          ) : null}
          <span>
            صفحه {page} از {totalPages}
          </span>
          {page < totalPages ? (
            <a
              href={`/category/${slug}${categoryPageQuery(searchParams, page + 1)}`}
              className="rounded-full border border-[var(--brand-border,#E8E0D4)] px-4 py-2"
            >
              بعدی
            </a>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

import Link from 'next/link';
import { CategoryProductCard } from './CategoryProductCard';
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
              href={`/category/${slug}${categoryPageQuery(searchParams, page - 1)}`}
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
              href={`/category/${slug}${categoryPageQuery(searchParams, page + 1)}`}
              className="rounded-full border border-[var(--brand-border,#E8E0D4)] px-4 py-2"
            >
              بعدی
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

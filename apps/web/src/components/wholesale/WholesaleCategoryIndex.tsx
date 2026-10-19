import Image from 'next/image';
import Link from 'next/link';
import {
  WHOLESALE_CATEGORY_INDEX_CAP,
  categoryDisplayName,
  categoryStorefrontHref,
  merchandiseCategories,
} from '@/lib/catalog/category-storefront';
import {
  fetchStorefrontCategories,
  type StorefrontCategoryRow,
} from '@/lib/catalog/fetch-storefront-categories';

export type WholesaleCategoryTile = {
  id: string;
  name: string;
  href: string;
  image?: string;
};

function mediaUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

export function toWholesaleCategoryTiles(
  rows: StorefrontCategoryRow[],
  opts?: { categoryIds?: string | null; maxItems?: unknown; homeOnly?: boolean },
): WholesaleCategoryTile[] {
  return merchandiseCategories(rows, {
    categoryIds: opts?.categoryIds,
    maxItems: opts?.maxItems ?? WHOLESALE_CATEGORY_INDEX_CAP,
    capCeiling: WHOLESALE_CATEGORY_INDEX_CAP,
    homeOnly: opts?.homeOnly,
  }).flatMap((row) => {
    const name = categoryDisplayName(row);
    if (!name) return [];
    return [
      {
        id: row.id,
        name,
        href: categoryStorefrontHref(row),
        image: mediaUrl(row.bannerUrl),
      },
    ];
  });
}

function columnClass(columns: number) {
  if (columns <= 2) return 'grid-cols-2';
  if (columns === 3) return 'grid-cols-2 sm:grid-cols-3';
  return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
}

/** Sync tiles so a page can fetch categories in parallel with the catalog. */
export function WholesaleCategoryIndexView({
  items,
  headline = 'دسته‌بندی محصولات',
  body = 'دسته‌های انتخاب‌شده برای صفحه اول؛ هر لینک به صفحهٔ همان مجموعه می‌رود.',
  columns = 4,
  showThumbs = true,
}: {
  items: WholesaleCategoryTile[];
  headline?: string;
  body?: string;
  columns?: number;
  /** Off on /products so category thumbs do not compete with the catalog LCP. */
  showThumbs?: boolean;
}) {
  if (items.length === 0) return null;
  const cols = Math.min(4, Math.max(2, columns || 4));

  return (
    <section className="border-b border-[color:var(--color-border)] bg-white py-10 sm:py-12" aria-labelledby="wholesale-categories-heading">
      <div className="container-site">
        <div className="mb-6 max-w-2xl">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-primary">دسته‌ها</p>
          <h2 id="wholesale-categories-heading" className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {headline}
          </h2>
          {body ? <p className="mt-2 text-sm leading-7 text-gray-600">{body}</p> : null}
        </div>
        <ul className={`grid gap-3 ${columnClass(cols)}`}>
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              <Link
                href={item.href}
                className="flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--color-border)] bg-surface-muted/40 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {showThumbs && item.image ? (
                  <Image
                    src={item.image}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                    fetchPriority="low"
                    sizes="48px"
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : showThumbs ? (
                  <span
                    aria-hidden
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary"
                  >
                    {item.name.slice(0, 1)}
                  </span>
                ) : null}
                <span className="min-w-0 truncate text-sm font-bold text-gray-900">{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export async function WholesaleCategoryIndex({
  headline,
  body,
  columns,
  maxItems,
  categoryIds,
}: {
  headline?: string;
  body?: string;
  columns?: number;
  maxItems?: unknown;
  categoryIds?: string;
}) {
  const rows = await fetchStorefrontCategories();
  // Home CMS block only — nav and /products keep the full ACTIVE list.
  const items = toWholesaleCategoryTiles(rows, { categoryIds, maxItems, homeOnly: true });
  return (
    <WholesaleCategoryIndexView items={items} headline={headline} body={body} columns={columns} />
  );
}

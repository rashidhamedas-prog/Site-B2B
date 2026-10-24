import Link from 'next/link';
import {
  WHOLESALE_CATEGORY_INDEX_CAP,
  categoryDisplayName,
  categoryStorefrontHref,
  merchandiseCategories,
} from '@/lib/catalog/category-storefront';
import { fetchStorefrontCategories } from '@/lib/catalog/fetch-storefront-categories';

export type WholesaleNavCategory = {
  id: string;
  name: string;
  slug?: string | null;
};

/**
 * Category menu in the document (not mounted on hover) so the links exist
 * without JavaScript. `<details>` covers keyboard and no-JS open.
 */
export async function loadWholesaleNavCategories(): Promise<WholesaleNavCategory[]> {
  const rows = await fetchStorefrontCategories();
  return merchandiseCategories(rows, {
    maxItems: WHOLESALE_CATEGORY_INDEX_CAP,
    capCeiling: WHOLESALE_CATEGORY_INDEX_CAP,
  }).flatMap((row) => {
    const name = categoryDisplayName(row);
    if (!name) return [];
    return [{ id: row.id, name, slug: row.slug ?? null }];
  });
}

export async function WholesaleCategoryNavSlot() {
  const categories = await loadWholesaleNavCategories();
  return <WholesaleCategoryNav categories={categories} />;
}

export async function WholesaleMobileCategorySlot() {
  const categories = await loadWholesaleNavCategories();
  if (categories.length === 0) return null;
  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="px-3 pb-1 text-xs font-bold text-[var(--brand-muted,#4B5563)]">دسته‌بندی محصولات</p>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={categoryStorefrontHref(category)}
          className="flex min-w-0 items-center truncate rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-primary-50 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {category.name}
        </Link>
      ))}
    </div>
  );
}

export function WholesaleCategoryNav({ categories }: { categories: WholesaleNavCategory[] }) {
  if (categories.length === 0) return null;

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-semibold text-gray-700 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        دسته‌بندی
        <span aria-hidden className="text-xs text-gray-400 motion-reduce:transform-none group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="absolute end-0 top-full z-50 pt-2">
        <div className="w-[min(92vw,22rem)] rounded-2xl border border-[color:var(--color-border)] bg-white p-3 shadow-lg">
          <ul className="grid max-h-[70vh] grid-cols-2 gap-1 overflow-y-auto">
            {categories.map((category) => (
              <li key={category.id} className="min-w-0">
                <Link
                  href={categoryStorefrontHref(category)}
                  className="block min-w-0 truncate rounded-lg px-2.5 py-2 text-sm font-semibold text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary hover:bg-primary-50 hover:text-primary"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/products"
            className="mt-2 block rounded-lg px-2.5 py-2 text-xs font-bold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            همه محصولات
          </Link>
        </div>
      </div>
    </details>
  );
}

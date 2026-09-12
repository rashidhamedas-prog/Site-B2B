import Link from 'next/link';
import {
  catalogFetchInit,
  categoryDisplayName,
  merchandiseCategories,
} from '@/lib/catalog/category-storefront';
import { getServerApiBase } from '@/lib/server-api';

type Category = {
  id: string;
  name: string;
  nameEn?: string | null;
  slug?: string | null;
};

async function fetchActiveCategories(): Promise<Category[]> {
  try {
    const base = getServerApiBase();
    const res = await fetch(`${base}/categories`, catalogFetchInit());
    if (!res.ok) return [];
    const all = (await res.json()) as Category[];
    return merchandiseCategories(Array.isArray(all) ? all : [], { maxItems: 16 });
  } catch {
    return [];
  }
}

/** Home shortcuts to live categories — no images, below the hero LCP. */
export async function RetailHomeCategoryLinks() {
  const items = await fetchActiveCategories();
  if (!items.length) return null;

  return (
    <nav
      className="border-b border-[var(--retail-border)] bg-[var(--retail-bg)]"
      aria-label="دسته‌های خرید تکی"
    >
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-sm leading-7 text-[var(--retail-muted)]">
          اگر یک تکه برای خودتان می‌خواهید، از دسته‌های زیر شروع کنید.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {items.map((item) => {
            const href = item.slug
              ? `/category/${encodeURIComponent(item.slug)}`
              : `/products?categoryId=${encodeURIComponent(item.id)}`;
            return (
              <li key={item.id}>
                <Link
                  href={href}
                  className="inline-flex rounded-full border border-[var(--retail-border)] bg-white px-4 py-2 text-sm font-bold text-[var(--retail-ink)] transition hover:border-[var(--retail-gold)] hover:text-[var(--retail-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--retail-gold)]"
                >
                  {categoryDisplayName(item)}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

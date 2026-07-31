import Image from 'next/image';
import Link from 'next/link';
import { getServerApiBase } from '@/lib/server-api';

type Category = {
  id: string;
  name: string;
  bannerUrl?: string | null;
};

const FALLBACK_BANNERS = [
  '/banners/category-2026/01-linen.webp',
  '/banners/category-2026/02-outerwear.webp',
  '/banners/category-2026/03-sets.webp',
  '/banners/category-2026/04-mint.webp',
  '/banners/category-2026/05-blouse.webp',
  '/banners/category-2026/06-cream.webp',
  '/banners/category-2026/07-jacket.webp',
  '/banners/category-2026/08-plaid.webp',
  '/banners/category-2026/09-blazer.webp',
];

function mediaUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

async function fetchCategories(
  categoryIds: string | undefined,
  maxItems: number,
): Promise<Category[]> {
  try {
    const base = getServerApiBase();
    const res = await fetch(`${base}/categories`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const all = (await res.json()) as Category[];
    const list = Array.isArray(all) ? all : [];
    const idFilter = (categoryIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    let filtered = list;
    if (idFilter.length) {
      const order = new Map(idFilter.map((id, i) => [id, i]));
      filtered = list
        .filter((c) => order.has(c.id))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }
    return filtered.slice(0, Math.max(1, maxItems));
  } catch {
    return [];
  }
}

/** SSR category banner grid — no client waterfall. */
export async function RetailCategoryBannerGrid({
  title = 'دسته‌بندی‌ها',
  body,
  columns = 3,
  maxItems = 9,
  categoryIds,
}: {
  title?: string;
  body?: string;
  columns?: number;
  maxItems?: number;
  categoryIds?: string;
}) {
  const items = await fetchCategories(categoryIds, maxItems);
  if (items.length === 0) return null;

  const cols = Math.min(4, Math.max(2, columns || 3));
  const gridClass =
    cols === 2
      ? 'grid-cols-2'
      : cols === 4
        ? 'grid-cols-2 sm:grid-cols-4'
        : 'grid-cols-2 sm:grid-cols-3';

  return (
    <section className="bg-[var(--retail-surface)] py-14 sm:py-18">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--retail-gold)]">CATEGORIES</p>
          <h2 className="mt-2 text-2xl font-extrabold text-[var(--retail-ink)] sm:text-3xl">{title}</h2>
          {body ? (
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--retail-muted)]">{body}</p>
          ) : null}
        </div>

        <div className={`grid gap-3 sm:gap-4 ${gridClass}`}>
          {items.map((c, i) => {
            const img = mediaUrl(c.bannerUrl) || FALLBACK_BANNERS[i % FALLBACK_BANNERS.length];
            return (
              <Link
                key={c.id}
                href={`/products?categoryId=${encodeURIComponent(c.id)}`}
                className="group relative block aspect-square overflow-hidden bg-[#124035] ring-1 ring-[var(--retail-border)] transition hover:ring-[var(--retail-gold)]/60"
              >
                {img ? (
                  <Image
                    src={img}
                    alt={c.name}
                    fill
                    className="object-cover object-center transition duration-500 group-hover:scale-[1.04]"
                    sizes="(max-width:640px) 50vw, 33vw"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F2F28]/85 via-[#0F2F28]/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                  <span className="block text-center text-sm font-extrabold text-white sm:text-base">
                    {c.name}
                  </span>
                  <span className="mt-1 block text-center text-[11px] font-medium tracking-wide text-[var(--retail-gold)] opacity-90">
                    مشاهده محصولات
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

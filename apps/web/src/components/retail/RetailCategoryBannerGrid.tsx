import Image from 'next/image';
import Link from 'next/link';
import { getServerApiBase } from '@/lib/server-api';

type Category = {
  id: string;
  name: string;
  bannerUrl?: string | null;
};

/** Map skuPrefix / name keywords → curated luxury plates (no Persian text burned in). */
const FALLBACK_BY_KEY: Record<string, string> = {
  blouses: '/banners/category-luxury-2026/blouses.webp',
  coats: '/banners/category-luxury-2026/coats.webp',
  kaftans: '/banners/category-luxury-2026/kaftans.webp',
  pants: '/banners/category-luxury-2026/pants.webp',
  skirts: '/banners/category-luxury-2026/skirts.webp',
  pantsuits: '/banners/category-luxury-2026/pantsuits.webp',
  'skirt-suits': '/banners/category-luxury-2026/skirt-suits.webp',
  'vests-skirts': '/banners/category-luxury-2026/vests-skirts.webp',
  'vests-pants': '/banners/category-luxury-2026/vests-pants.webp',
  'winter-wear': '/banners/category-luxury-2026/winter-wear.webp',
};

const FALLBACK_BANNERS = [
  '/banners/category-luxury-2026/blouses.webp',
  '/banners/category-luxury-2026/coats.webp',
  '/banners/category-luxury-2026/kaftans.webp',
  '/banners/category-luxury-2026/pants.webp',
  '/banners/category-luxury-2026/skirts.webp',
  '/banners/category-luxury-2026/pantsuits.webp',
  '/banners/category-luxury-2026/skirt-suits.webp',
  '/banners/category-luxury-2026/vests-skirts.webp',
  '/banners/category-luxury-2026/vests-pants.webp',
  '/banners/category-luxury-2026/winter-wear.webp',
];

function mediaUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

function displayName(name: string) {
  // "blouses شومیز" → prefer Persian part when present
  const parts = name.trim().split(/\s+/);
  const fa = parts.filter((p) => /[\u0600-\u06FF]/.test(p)).join(' ');
  return fa || name;
}

function fallbackFor(c: Category, index: number) {
  const key = (c.name.split(/\s+/)[0] || '').toLowerCase();
  return FALLBACK_BY_KEY[key] || FALLBACK_BANNERS[index % FALLBACK_BANNERS.length];
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
    } else {
      // Stable retail order: reverse createdAt DESC from API → oldest first feels catalog-like
      filtered = [...list].reverse();
    }
    // maxItems 0 / very high = show all
    if (!maxItems || maxItems >= 999) return filtered;
    return filtered.slice(0, Math.max(1, maxItems));
  } catch {
    return [];
  }
}

/** Luxury SSR category grid — full-bleed editorial tiles linking to each category. */
export async function RetailCategoryBannerGrid({
  title = 'دسته‌بندی‌ها',
  body,
  columns = 5,
  maxItems = 99,
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

  const cols = Math.min(5, Math.max(2, columns || 5));
  const gridClass =
    cols === 2
      ? 'grid-cols-2'
      : cols === 3
        ? 'grid-cols-2 sm:grid-cols-3'
        : cols === 4
          ? 'grid-cols-2 sm:grid-cols-4'
          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5';

  return (
    <section className="relative overflow-hidden bg-[var(--retail-bg)] py-12 sm:py-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-[var(--retail-gold)]/50 to-transparent"
        aria-hidden
      />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center sm:mb-10">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[var(--retail-gold)]">
            CATEGORIES
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--retail-ink)] sm:text-3xl">
            {title}
          </h2>
          {body ? (
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--retail-muted)]">{body}</p>
          ) : null}
        </div>

        <div className={`grid gap-3 sm:gap-4 ${gridClass}`}>
          {items.map((c, i) => {
            const img = mediaUrl(c.bannerUrl) || fallbackFor(c, i);
            const label = displayName(c.name);
            return (
              <Link
                key={c.id}
                href={`/products?categoryId=${encodeURIComponent(c.id)}`}
                className="group relative block aspect-[4/5] cursor-pointer overflow-hidden bg-[var(--retail-primary-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--retail-gold)]"
              >
                {img ? (
                  <Image
                    src={img}
                    alt={label}
                    fill
                    className="object-cover object-center transition duration-700 ease-out group-hover:scale-[1.06]"
                    sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 20vw"
                    // Below the hero — must not compete with the LCP slide for
                    // bandwidth (only one above-the-fold image gets priority).
                    loading="lazy"
                  />
                ) : null}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-[#0a1f1a]/90 via-[#0F2F28]/35 to-transparent transition duration-500 group-hover:from-[#0a1f1a]/95"
                  aria-hidden
                />
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                  <span className="mx-auto mb-2 block h-px w-8 bg-[var(--retail-gold)]/80 transition-all duration-500 group-hover:w-12" />
                  <span className="block text-center text-sm font-extrabold text-white sm:text-[15px]">
                    {label}
                  </span>
                  <span className="mt-1.5 block text-center text-[10px] font-medium tracking-[0.14em] text-[var(--retail-gold-light)] opacity-90 transition duration-500 md:opacity-0 md:group-hover:opacity-100">
                    مشاهده مجموعه
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

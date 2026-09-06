import Image from 'next/image';
import Link from 'next/link';
import { getServerApiBase } from '@/lib/server-api';

type Category = {
  id: string;
  name: string;
  slug?: string | null;
  bannerUrl?: string | null;
};

const FALLBACKS = [
  '/banners/category-luxury-2026/blouses.webp',
  '/banners/category-luxury-2026/coats.webp',
  '/banners/category-luxury-2026/winter-wear.webp',
  '/banners/category-luxury-2026/kaftans.webp',
];

function mediaUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

function displayName(name: string) {
  const fa = name
    .trim()
    .split(/\s+/)
    .filter((p) => /[\u0600-\u06FF]/.test(p))
    .join(' ');
  return fa || name;
}

async function fetchCategories(): Promise<Category[]> {
  try {
    const base = getServerApiBase();
    const res = await fetch(`${base}/categories`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const all = (await res.json()) as Category[];
    return (Array.isArray(all) ? all : []).slice(0, 8);
  } catch {
    return [];
  }
}

export async function BoutiqueCategoryRow() {
  const categories = await fetchCategories();
  if (categories.length === 0) return null;

  return (
    <nav className="bq-container py-4" aria-label="دسته‌های پوشاک ترنم">
      <ul className="bq-rail">
        {categories.map((c, i) => {
          const src = mediaUrl(c.bannerUrl) || FALLBACKS[i % FALLBACKS.length];
          const href = c.slug ? `/category/${c.slug}` : `/products?categoryId=${c.id}`;
          return (
            <li key={c.id} className="w-[7.5rem] shrink-0 sm:w-36">
              <Link href={href} className="block">
                <span className="relative flex aspect-[4/5] items-end justify-center overflow-hidden rounded-2xl bg-[#f3eee6]">
                  <Image
                    src={src}
                    alt=""
                    fill
                    loading="lazy"
                    className="object-cover"
                    sizes="144px"
                  />
                </span>
                <span className="mt-2 block text-center text-xs font-bold text-white sm:text-sm">
                  {displayName(c.name)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

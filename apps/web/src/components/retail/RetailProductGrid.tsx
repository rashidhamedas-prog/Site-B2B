import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { getServerApiBase } from '@/lib/server-api';

type Product = {
  id: string;
  name: string;
  slug: string;
  retailPrice?: number | null;
  images?: string[];
};

function mediaUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

function toman(irr: number) {
  return Math.round(irr / 10).toLocaleString('fa-IR');
}

const FALLBACK: Product[] = [
  { id: 'f1', name: 'شلوار یخی کمربندی', slug: '#', retailPrice: 18800000, images: [] },
  { id: 'f2', name: 'مانتو جلو باز تابستانه', slug: '#', retailPrice: 24500000, images: [] },
  { id: 'f3', name: 'شومیز آستین پفی', slug: '#', retailPrice: 16800000, images: [] },
  { id: 'f4', name: 'شلوار بگ گلدوزی', slug: '#', retailPrice: 19800000, images: [] },
];

async function fetchRetailProducts(limit: number, sort: string): Promise<Product[]> {
  try {
    const base = getServerApiBase();
    const sortQ = sort ? `&sort=${encodeURIComponent(sort)}` : '';
    const res = await fetch(
      `${base}/products?limit=${limit}&status=ACTIVE&channel=RETAIL${sortQ}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : data?.data ?? [];
    return list as Product[];
  } catch {
    return [];
  }
}

/** SSR product grid for retail home — no client waterfall. */
export async function RetailProductGrid({
  title = 'پربازدیدترین‌ها',
  limit = 12,
  sort = 'views',
}: {
  title?: string;
  limit?: number;
  sort?: string;
}) {
  const fetched = await fetchRetailProducts(limit, sort);
  const products =
    fetched.length > 0 ? fetched : FALLBACK.slice(0, Math.min(limit, FALLBACK.length));

  return (
    <section className="relative overflow-hidden bg-[var(--retail-bg)] py-16 sm:py-20">
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
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--retail-gold)]">COLLECTION</p>
          <h2 className="mt-2 text-2xl font-extrabold text-[var(--retail-ink)] sm:text-3xl">{title}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {products.map((p) => {
            const img = mediaUrl(p.images?.[0]);
            const price = Number(p.retailPrice ?? 0);
            const href = p.slug === '#' ? '/products' : `/products/${p.slug}`;
            return (
              <Link
                key={p.id}
                href={href}
                className="group relative block border border-[var(--retail-border)] bg-[var(--retail-card)] transition hover:border-[var(--retail-gold)]/50"
              >
                <span
                  className="absolute left-3 top-3 z-10 rounded-full bg-white/80 p-1.5 text-[var(--retail-ink)]/50 opacity-80"
                  aria-hidden
                >
                  <Heart className="h-4 w-4" strokeWidth={1.4} />
                </span>
                <div className="relative aspect-[3/4] overflow-hidden bg-[var(--retail-card)]">
                  {img ? (
                    <Image
                      src={img}
                      alt={p.name}
                      fill
                      className="object-cover object-center transition duration-500 group-hover:scale-[1.03]"
                      sizes="(max-width:768px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[var(--retail-muted)]">
                      تصویر به‌زودی
                    </div>
                  )}
                </div>
                <div className="bg-[var(--retail-surface)] px-3 py-4 text-center">
                  <h3 className="line-clamp-2 text-[13px] font-semibold text-[var(--retail-ink)]">{p.name}</h3>
                  <p className="mt-2 text-sm font-bold text-[var(--retail-ink)]">
                    {price > 0 ? `${toman(price)} تومان` : 'قیمت به‌زودی'}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/retail/products"
            className="inline-flex cursor-pointer border-b border-[var(--retail-gold)] pb-0.5 text-sm font-bold text-[var(--retail-primary)]"
          >
            مشاهده همه محصولات
          </Link>
        </div>
      </div>
    </section>
  );
}

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { RETAIL_ORIGIN } from '@/lib/seo';
import { getServerApiBase } from '@/lib/server-api';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'کلکسیون‌ها',
  description:
    'کلکسیون‌های فصلی مانتو و شومیز زنانه ترنم — انتخاب سریع‌تر بر اساس فصل و استایل، مستقیم از تولیدی مشهد.',
  alternates: { canonical: `${RETAIL_ORIGIN}/collections` },
  openGraph: {
    title: 'کلکسیون‌های پوشاک ترنم',
    description: 'کلکسیون‌های فصلی مانتو و شومیز زنانه — مستقیم از تولیدی ترنم.',
    url: `${RETAIL_ORIGIN}/collections`,
    type: 'website',
    locale: 'fa_IR',
  },
};

type Collection = {
  id: string;
  name: string;
  slug: string;
  season?: string;
  description?: string;
  imageUrl?: string;
};

function mediaUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

async function fetchCollections(): Promise<Collection[]> {
  try {
    const res = await fetch(`${getServerApiBase()}/collections?active=1`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function RetailCollectionsPage() {
  const rows = await fetchCollections();

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold">کلکسیون‌ها</h1>
      <p className="mt-3 max-w-2xl text-sm text-[var(--retail-muted)]">
        انتخاب سریع‌تر بر اساس فصل و استایل — مستقیم از تولیدی ترنم.
      </p>

      {rows.length === 0 ? (
        <div className="mt-10">
          <p className="text-sm text-[var(--retail-muted)]">هنوز کالکشنی منتشر نشده است.</p>
          <Link
            href="/products"
            className="mt-6 inline-flex cursor-pointer rounded-full bg-[var(--retail-primary)] px-6 py-3 text-sm font-bold text-white"
          >
            رفتن به فروشگاه
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => {
            const img = mediaUrl(c.imageUrl);
            return (
              <Link
                key={c.id}
                href={`/products?collectionId=${c.id}`}
                className="group overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--retail-border)]"
              >
                <div className="relative aspect-[4/3] bg-[var(--retail-bg)]">
                  {img ? (
                    <Image src={img} alt={c.name} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="33vw" />
                  ) : null}
                </div>
                <div className="p-4">
                  {c.season ? <p className="text-xs font-bold text-[var(--retail-gold)]">{c.season}</p> : null}
                  <h2 className="mt-1 text-lg font-extrabold">{c.name}</h2>
                  {c.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-[var(--retail-muted)]">{c.description}</p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

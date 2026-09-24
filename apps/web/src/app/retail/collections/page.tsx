import Image from 'next/image';
import Link from 'next/link';
import { CmsPageIntro } from '@/components/cms/CmsPageIntro';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { RETAIL_ORIGIN } from '@/lib/seo';
import { getServerApiBase } from '@/lib/server-api';

export const revalidate = 300;

export async function generateMetadata() {
  return metadataForCmsPage('RETAIL', 'collections', {
    title: 'کلکسیون‌ها',
    description:
      'کلکسیون‌های فصلی مانتو و شومیز زنانه ترنم — انتخاب سریع‌تر بر اساس فصل و استایل، مستقیم از تولیدی مشهد.',
    canonical: `${RETAIL_ORIGIN}/collections`,
    ogAlt: 'کلکسیون‌های پوشاک ترنم',
  });
}

type Collection = {
  id: string;
  name: string;
  slug: string;
  season?: string;
  description?: string;
  imageUrl?: string;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  heroImage?: string | null;
  imageUrl?: string | null;
};

function mediaUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

async function fetchCollections(): Promise<Collection[]> {
  try {
    const res = await fetch(`${getServerApiBase()}/collections?active=1&channel=RETAIL`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchRetailCategories(): Promise<CategoryRow[]> {
  try {
    const res = await fetch(`${getServerApiBase()}/categories`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    return rows.filter((c: CategoryRow) => c?.slug && c?.name);
  } catch {
    return [];
  }
}

export default async function RetailCollectionsPage() {
  const [rows, categories] = await Promise.all([fetchCollections(), fetchRetailCategories()]);
  const usingCategories = rows.length === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold">کلکسیون‌ها</h1>
      <CmsPageIntro channel="RETAIL" pageKey="collections" />
      {usingCategories ? (
        <p className="mt-3 text-sm text-[var(--retail-muted)]">
          دسته‌های فعال فروشگاه — برای مرور سریع‌تر بر اساس نوع لباس.
        </p>
      ) : null}

      {rows.length === 0 && categories.length === 0 ? (
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
          {(rows.length ? rows : categories).map((c) => {
            const img = mediaUrl(
              ('imageUrl' in c ? (c as Collection).imageUrl : undefined) ||
                ('heroImage' in c ? (c as CategoryRow).heroImage : undefined),
            );
            const href = rows.length
              ? `/products?collectionId=${(c as Collection).id}`
              : `/category/${c.slug}`;
            return (
              <Link
                key={c.id || c.slug}
                href={href}
                className="group overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--retail-border)]"
              >
                <div className="relative aspect-[4/3] bg-[var(--retail-bg)]">
                  {img ? (
                    <Image
                      src={img}
                      alt={c.name}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                      sizes="33vw"
                    />
                  ) : null}
                </div>
                <div className="p-5">
                  <h2 className="text-lg font-extrabold">{c.name}</h2>
                  {'season' in c && (c as Collection).season ? (
                    <p className="mt-1 text-xs text-[var(--retail-muted)]">{(c as Collection).season}</p>
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

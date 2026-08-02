import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchTagBundle, categoryColor, formatJalali } from '@/lib/blog';
import { RETAIL_ORIGIN } from '@/lib/seo';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchTagBundle(decodeURIComponent(slug), 'RETAIL');
  if (!data?.tag) return { title: 'برچسب یافت نشد', robots: { index: false } };
  const title = data.tag.seoTitle || data.tag.name;
  return {
    title: `${title} | وبلاگ ترنم`,
    description: data.tag.metaDescription || data.tag.description || `مقالات برچسب ${data.tag.name}`,
    alternates: { canonical: `${RETAIL_ORIGIN}/blog/tag/${data.tag.slug}` },
    robots: data.tag.robotsIndex ? 'index,follow' : 'noindex,follow',
  };
}

export default async function RetailBlogTagPage({ params }: Props) {
  const { slug } = await params;
  const data = await fetchTagBundle(decodeURIComponent(slug), 'RETAIL');
  if (!data?.tag) notFound();
  const { tag, items } = data;

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <section className="bg-gradient-to-bl from-[#2c1810] via-[#4a2c1a] to-[#6b3f24] py-12 text-white">
        <div className="mx-auto max-w-4xl px-4">
          <Link href="/blog" className="mb-4 inline-block text-sm text-white/70">
            ← وبلاگ
          </Link>
          <p className="mb-1 text-xs text-white/60">برچسب</p>
          <h1 className="text-2xl font-extrabold">#{tag.name}</h1>
        </div>
      </section>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {(items || []).map(
            (p: {
              slug: string;
              title: string;
              excerpt?: string;
              category: string;
              publishedAt?: string;
            }) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="rounded-xl border border-stone-200 bg-white p-5"
              >
                <span
                  className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor(p.category)}`}
                >
                  {p.category}
                </span>
                <h2 className="text-sm font-bold">{p.title}</h2>
                {p.excerpt && <p className="mt-2 line-clamp-2 text-xs text-stone-500">{p.excerpt}</p>}
                <p className="mt-3 text-[11px] text-stone-400">{formatJalali(p)}</p>
              </Link>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

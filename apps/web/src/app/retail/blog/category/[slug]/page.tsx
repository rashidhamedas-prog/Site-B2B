import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchCategoryBundle, categoryColor, formatJalali } from '@/lib/blog';
import { RETAIL_ORIGIN } from '@/lib/seo';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchCategoryBundle(decodeURIComponent(slug), 'RETAIL');
  if (!data?.category) return { title: 'دسته یافت نشد', robots: { index: false } };
  return {
    title: `${data.category.name} | وبلاگ ترنم`,
    description: data.category.description || `مقالات دسته ${data.category.name}`,
    alternates: { canonical: `${RETAIL_ORIGIN}/blog/category/${data.category.slug}` },
    robots: data.category.robotsIndex === false ? 'noindex,follow' : 'index,follow',
  };
}

export default async function RetailBlogCategoryPage({ params }: Props) {
  const { slug } = await params;
  const data = await fetchCategoryBundle(decodeURIComponent(slug), 'RETAIL');
  if (!data?.category) notFound();
  const { category, items } = data;

  return (
    <div className="min-h-screen bg-[#F6F1E8]">
      <section className="bg-gradient-to-bl from-[#0F2F28] via-[#1B5C4A] to-[#1B5C4A] py-12 text-white">
        <div className="mx-auto max-w-4xl px-4">
          <Link href="/blog" className="mb-4 inline-block text-sm text-white/70">
            ← وبلاگ
          </Link>
          <h1 className="text-2xl font-extrabold">{category.name}</h1>
        </div>
      </section>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {(items || []).map((p: { slug: string; title: string; excerpt?: string; category: string; publishedAt?: string }) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="rounded-xl border border-stone-200 bg-white p-5">
              <span className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor(p.category)}`}>
                {p.category}
              </span>
              <h2 className="text-sm font-bold">{p.title}</h2>
              {p.excerpt && <p className="mt-2 line-clamp-2 text-xs text-stone-500">{p.excerpt}</p>}
              <p className="mt-3 text-[11px] text-stone-400">{formatJalali(p)}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

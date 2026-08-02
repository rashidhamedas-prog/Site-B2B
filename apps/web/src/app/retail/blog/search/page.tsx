import type { Metadata } from 'next';
import Link from 'next/link';
import { searchBlogPosts, categoryColor, formatJalali } from '@/lib/blog';
import { RETAIL_ORIGIN } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'جست‌وجوی وبلاگ',
  robots: { index: false, follow: true },
  alternates: { canonical: `${RETAIL_ORIGIN}/blog/search` },
};

export const revalidate = 60;

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function RetailBlogSearchPage({ searchParams }: Props) {
  const { q = '' } = await searchParams;
  const { posts, meta } = await searchBlogPosts(q, 'RETAIL');

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-4 text-2xl font-extrabold text-stone-900">جست‌وجوی وبلاگ</h1>
        <form className="mb-8">
          <input
            name="q"
            defaultValue={q}
            placeholder="عبارت جست‌وجو…"
            className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm"
          />
        </form>
        {q && (
          <p className="mb-4 text-xs text-stone-500">
            {(meta?.total ?? posts.length).toLocaleString('fa-IR')} نتیجه برای «{q}»
          </p>
        )}
        <div className="space-y-3">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="block rounded-xl border border-stone-200 bg-white p-4">
              <span className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor(p.category)}`}>
                {p.category}
              </span>
              <h2 className="text-sm font-bold">{p.title}</h2>
              <p className="mt-1 line-clamp-2 text-xs text-stone-500">{p.excerpt}</p>
              <p className="mt-2 text-[11px] text-stone-400">{formatJalali(p)}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

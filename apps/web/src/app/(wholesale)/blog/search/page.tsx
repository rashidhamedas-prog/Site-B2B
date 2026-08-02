import type { Metadata } from 'next';
import Link from 'next/link';
import { searchBlogPosts, categoryColor, formatJalali } from '@/lib/blog';
import { WHOLESALE_ORIGIN } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'جست‌وجوی وبلاگ',
  robots: { index: false, follow: true },
  alternates: { canonical: `${WHOLESALE_ORIGIN}/blog/search` },
};

export const revalidate = 60;

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function WholesaleBlogSearchPage({ searchParams }: Props) {
  const { q = '' } = await searchParams;
  const { posts, meta } = await searchBlogPosts(q, 'WHOLESALE');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-site max-w-3xl py-10">
        <h1 className="mb-4 text-2xl font-extrabold">جست‌وجوی وبلاگ</h1>
        <form className="mb-8">
          <input
            name="q"
            defaultValue={q}
            placeholder="عبارت جست‌وجو…"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
          />
        </form>
        {q && (
          <p className="mb-4 text-xs text-gray-500">
            {(meta?.total ?? posts.length).toLocaleString('fa-IR')} نتیجه برای «{q}»
          </p>
        )}
        <div className="space-y-3">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="card block p-4 hover:shadow-md">
              <span className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor(p.category)}`}>
                {p.category}
              </span>
              <h2 className="text-sm font-bold">{p.title}</h2>
              <p className="mt-1 line-clamp-2 text-xs text-gray-500">{p.excerpt}</p>
              <p className="mt-2 text-[11px] text-gray-400">{formatJalali(p)}</p>
            </Link>
          ))}
        </div>
        {q && posts.length === 0 && <p className="text-center text-sm text-gray-400">نتیجه‌ای یافت نشد.</p>}
      </div>
    </div>
  );
}

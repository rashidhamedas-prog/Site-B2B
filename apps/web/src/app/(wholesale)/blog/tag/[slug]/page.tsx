import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchTagBundle, categoryColor, formatJalali } from '@/lib/blog';
import { WHOLESALE_ORIGIN } from '@/lib/seo';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchTagBundle(decodeURIComponent(slug), 'WHOLESALE');
  if (!data?.tag) return { title: 'برچسب یافت نشد', robots: { index: false } };
  const title = data.tag.seoTitle || data.tag.name;
  return {
    title: `${title} | وبلاگ ترنم`,
    description: data.tag.metaDescription || data.tag.description || `مقالات برچسب ${data.tag.name}`,
    alternates: { canonical: `${WHOLESALE_ORIGIN}/blog/tag/${data.tag.slug}` },
    robots: data.tag.robotsIndex ? 'index,follow' : 'noindex,follow',
  };
}

export default async function WholesaleBlogTagPage({ params }: Props) {
  const { slug } = await params;
  const data = await fetchTagBundle(decodeURIComponent(slug), 'WHOLESALE');
  if (!data?.tag) notFound();
  const { tag, items } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-gradient-to-bl from-primary-dark via-primary to-primary-light py-12 text-white">
        <div className="container-site max-w-4xl">
          <Link href="/blog" className="mb-4 inline-block text-sm text-white/70 hover:text-white">
            ← وبلاگ
          </Link>
          <p className="mb-1 text-xs text-white/60">برچسب</p>
          <h1 className="text-2xl font-extrabold sm:text-3xl">#{tag.name}</h1>
          {tag.description && <p className="mt-2 text-sm text-white/70">{tag.description}</p>}
        </div>
      </section>
      <div className="container-site max-w-4xl py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {(items || []).map(
            (p: {
              slug: string;
              title: string;
              excerpt?: string;
              category: string;
              publishedAt?: string;
            }) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="card p-5 transition hover:shadow-md">
                <span
                  className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor(p.category)}`}
                >
                  {p.category}
                </span>
                <h2 className="text-sm font-bold text-gray-900">{p.title}</h2>
                {p.excerpt && <p className="mt-2 line-clamp-2 text-xs text-gray-500">{p.excerpt}</p>}
                <p className="mt-3 text-[11px] text-gray-400">{formatJalali(p)}</p>
              </Link>
            ),
          )}
        </div>
        {(items || []).length === 0 && (
          <p className="text-center text-sm text-gray-400">مطلبی با این برچسب نیست.</p>
        )}
      </div>
    </div>
  );
}

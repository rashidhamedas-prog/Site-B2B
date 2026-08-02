import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchCategoryBundle, categoryColor, formatJalali } from '@/lib/blog';
import { WHOLESALE_ORIGIN } from '@/lib/seo';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchCategoryBundle(decodeURIComponent(slug), 'WHOLESALE');
  if (!data?.category) return { title: 'دسته یافت نشد', robots: { index: false } };
  return {
    title: `${data.category.name} | وبلاگ ترنم`,
    description: data.category.description || `مقالات دسته ${data.category.name}`,
    alternates: { canonical: `${WHOLESALE_ORIGIN}/blog/category/${data.category.slug}` },
    robots: data.category.robotsIndex === false ? 'noindex,follow' : 'index,follow',
  };
}

export default async function WholesaleBlogCategoryPage({ params }: Props) {
  const { slug } = await params;
  const data = await fetchCategoryBundle(decodeURIComponent(slug), 'WHOLESALE');
  if (!data?.category) notFound();
  const { category, items } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-gradient-to-bl from-primary-dark via-primary to-primary-light py-12 text-white">
        <div className="container-site max-w-4xl">
          <Link href="/blog" className="mb-4 inline-block text-sm text-white/70 hover:text-white">
            ← وبلاگ
          </Link>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{category.name}</h1>
          {category.description && <p className="mt-2 text-sm text-white/70">{category.description}</p>}
        </div>
      </section>
      <div className="container-site max-w-4xl py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {(items || []).map((p: { slug: string; title: string; excerpt?: string; category: string; publishedAt?: string }) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="card p-5 transition hover:shadow-md">
              <span className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor(p.category)}`}>
                {p.category}
              </span>
              <h2 className="text-sm font-bold text-gray-900">{p.title}</h2>
              {p.excerpt && <p className="mt-2 line-clamp-2 text-xs text-gray-500">{p.excerpt}</p>}
              <p className="mt-3 text-[11px] text-gray-400">{formatJalali(p)}</p>
            </Link>
          ))}
        </div>
        {(items || []).length === 0 && <p className="text-center text-sm text-gray-400">مطلبی در این دسته نیست.</p>}
      </div>
    </div>
  );
}

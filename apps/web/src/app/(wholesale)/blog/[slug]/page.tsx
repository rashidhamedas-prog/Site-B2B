import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, Clock, Tag, ArrowRight } from 'lucide-react';
import { fetchPost, fetchPosts, categoryColor, formatJalali, readTime } from '@/lib/blog';
import { ArticleJsonLd, BreadcrumbJsonLd } from '@/components/shared/JsonLd';
import { WHOLESALE_ORIGIN } from '@/lib/seo';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(decodeURIComponent(slug));
  if (!post) return { title: 'مطلب یافت نشد' };
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt;
  const url = `${WHOLESALE_ORIGIN}/blog/${post.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      locale: 'fa_IR',
      images: post.coverImage
        ? [{ url: post.coverImage, alt: title }]
        : [{ url: '/og-wholesale.jpg', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

function renderMarkdown(md: string) {
  const blocks = md.split(/\n\n+/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={i} className="mt-6 mb-2 text-base font-bold text-gray-900">
          {trimmed.slice(4)}
        </h3>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={i} className="mt-8 mb-3 text-lg font-bold text-gray-900">
          {trimmed.slice(3)}
        </h2>
      );
    }
    if (trimmed.split('\n').every((l) => l.trim().startsWith('- '))) {
      return (
        <ul key={i} className="list-disc space-y-1.5 pr-5 text-sm leading-relaxed text-gray-600">
          {trimmed.split('\n').map((l, j) => {
            const item = l.trim().slice(2);
            const parts = item.split(/\*\*(.+?)\*\*/g);
            return (
              <li key={j}>
                {parts.map((p, k) =>
                  k % 2 === 1 ? (
                    <strong key={k} className="text-gray-800">
                      {p}
                    </strong>
                  ) : (
                    p
                  ),
                )}
              </li>
            );
          })}
        </ul>
      );
    }
    const parts = trimmed.split(/\*\*(.+?)\*\*/g);
    return (
      <p key={i} className="text-sm leading-loose text-gray-600">
        {parts.map((p, k) =>
          k % 2 === 1 ? (
            <strong key={k} className="text-gray-800">
              {p}
            </strong>
          ) : (
            p
          ),
        )}
      </p>
    );
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await fetchPost(decodeURIComponent(slug));
  if (!post) notFound();

  const { posts } = await fetchPosts();
  const related = posts
    .filter((p) => p.slug !== post.slug && p.category === post.category)
    .slice(0, 3);
  const url = `${WHOLESALE_ORIGIN}/blog/${post.slug}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <ArticleJsonLd
        title={post.seoTitle || post.title}
        description={post.seoDescription || post.excerpt}
        url={url}
        image={post.coverImage || undefined}
        datePublished={post.publishedAt}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'خانه', url: `${WHOLESALE_ORIGIN}/` },
          { name: 'وبلاگ', url: `${WHOLESALE_ORIGIN}/blog` },
          { name: post.title, url },
        ]}
      />
      <section className="bg-gradient-to-bl from-primary-dark via-primary to-primary-light py-14 text-white">
        <div className="container-site max-w-3xl">
          <Link
            href="/blog"
            className="mb-5 inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
          >
            <ArrowRight className="h-4 w-4" />
            بازگشت به وبلاگ
          </Link>
          <span
            className={`mb-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${categoryColor(post.category)}`}
          >
            <Tag className="h-3 w-3" />
            {post.category}
          </span>
          <h1 className="mb-4 text-2xl font-extrabold leading-snug sm:text-3xl">{post.title}</h1>
          <div className="flex items-center gap-4 text-xs text-white/60">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatJalali(post)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {readTime(post)}
            </span>
          </div>
        </div>
      </section>

      <div className="container-site max-w-3xl py-10">
        <article className="card space-y-4 p-6 sm:p-10">
          <p className="text-sm font-medium leading-loose text-gray-700">{post.excerpt}</p>
          <hr className="border-gray-100" />
          {renderMarkdown(post.content ?? '')}
        </article>

        {related.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-base font-bold text-gray-900">مطالب مرتبط</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="card group p-4 transition-shadow hover:shadow-md"
                >
                  <span
                    className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor(r.category)}`}
                  >
                    {r.category}
                  </span>
                  <p className="text-xs font-bold leading-snug text-gray-900 transition-colors group-hover:text-primary">
                    {r.title}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 rounded-2xl bg-primary p-8 text-center text-white">
          <h3 className="mb-2 text-lg font-bold">خرید عمده مانتو مستقیم از تولیدی</h3>
          <p className="mb-5 text-sm text-white/70">کاتالوگ کامل مدل‌های لینن و کتان ترنم را ببینید</p>
          <Link
            href="/products"
            className="inline-block rounded-xl bg-secondary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary/90"
          >
            مشاهده محصولات
          </Link>
        </div>
      </div>
    </div>
  );
}

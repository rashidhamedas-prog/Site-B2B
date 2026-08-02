import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { Calendar, Clock, Tag, ArrowRight } from 'lucide-react';
import {
  fetchPost,
  fetchPosts,
  fetchBlogRedirect,
  categoryColor,
  formatJalali,
  readTime,
  buildRobotsContent,
} from '@/lib/blog';
import { ArticleJsonLd, BreadcrumbJsonLd, FaqJsonLd } from '@/components/shared/JsonLd';
import { BlogContent } from '@/components/blog/BlogContent';
import { BlogHowTo, HowToJsonLd } from '@/components/blog/BlogHowTo';
import { BlogRelatedProducts } from '@/components/blog/BlogRelatedProducts';
import { BlogComments } from '@/components/blog/BlogComments';
import { BlogAnalyticsTracker } from '@/components/blog/BlogAnalyticsTracker';
import { BlogToc, extractToc, injectHeadingIds } from '@/components/blog/BlogToc';
import { WHOLESALE_ORIGIN } from '@/lib/seo';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

async function resolveOrRedirect(slug: string) {
  const post = await fetchPost(slug, 'WHOLESALE');
  if (post) return post;
  const redir = await fetchBlogRedirect(`/blog/${slug}`, 'WHOLESALE');
  if (!redir) return null;
  if (redir.statusCode === 410 || redir.destinationUrl === 'gone:410') {
    return 'GONE' as const;
  }
  const dest = redir.destinationUrl.startsWith('http')
    ? redir.destinationUrl
    : redir.destinationUrl.startsWith('/')
      ? redir.destinationUrl
      : `/${redir.destinationUrl}`;
  if (redir.statusCode === 302) redirect(dest);
  permanentRedirect(dest);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(decodeURIComponent(slug), 'WHOLESALE');
  if (!post) return { title: 'مطلب یافت نشد', robots: { index: false } };
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt;
  const url = `${WHOLESALE_ORIGIN}/blog/${post.slug}`;
  const ogImage = post.ogImage || post.coverImage;
  return {
    title,
    description,
    robots: buildRobotsContent(post),
    alternates: {
      canonical:
        post.canonicalType === 'CUSTOM' && post.canonicalUrl
          ? post.canonicalUrl
          : post.canonicalType === 'NONE'
            ? undefined
            : url,
    },
    openGraph: {
      title: post.ogTitle || title,
      description: post.ogDescription || description,
      url,
      type: 'article',
      locale: 'fa_IR',
      images: ogImage
        ? [{ url: ogImage, alt: title }]
        : [{ url: '/og-wholesale.jpg', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: (post.twitterCard as 'summary_large_image') || 'summary_large_image',
      title: post.twitterTitle || title,
      description: post.twitterDescription || description,
      images: post.twitterImage || ogImage || undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const resolved = await resolveOrRedirect(decodeURIComponent(slug));
  if (resolved === 'GONE') {
    return (
      <div className="container-site max-w-xl py-24 text-center">
        <h1 className="mb-3 text-2xl font-extrabold">مطلب حذف شده است</h1>
        <p className="mb-6 text-sm text-gray-500">این صفحه دیگر در دسترس نیست (۴۱۰).</p>
        <Link href="/blog" className="btn btn-primary btn-sm">
          بازگشت به وبلاگ
        </Link>
      </div>
    );
  }
  if (!resolved) notFound();
  const post = resolved;

  const { posts } = await fetchPosts({ channel: 'WHOLESALE', limit: 12 });
  const related = posts
    .filter((p) => p.slug !== post.slug && p.category === post.category)
    .slice(0, 3);
  const url = `${WHOLESALE_ORIGIN}/blog/${post.slug}`;
  const faqVisible = (post.faqItems || []).filter(
    (f) => f.isVisible !== false && f.question && f.answer,
  );
  const toc =
    post.tableOfContentsEnabled !== false
      ? extractToc(post.content || '', post.tableOfContentsDepth || 3)
      : [];
  const contentHtml =
    (post.contentFormat === 'HTML' || (post.content || '').trim().startsWith('<')) && toc.length
      ? injectHeadingIds(post.content || '', toc)
      : post.content || '';
  const howToLd =
    post.howToSchemaEnabled !== false && post.howToData?.steps?.length
      ? {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: post.howToData.name,
          description: post.howToData.description,
          totalTime: post.howToData.totalTime,
          step: post.howToData.steps.map((s, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name: s.title,
            text: s.description,
          })),
        }
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <BlogAnalyticsTracker articleId={String(post.id)} title={post.title} />
      {post.articleSchemaEnabled !== false && (
        <ArticleJsonLd
          title={post.seoTitle || post.title}
          description={post.seoDescription || post.excerpt}
          url={url}
          image={post.coverImage || undefined}
          datePublished={post.publishedAt}
          dateModified={post.updatedAt}
          authorName={post.authorName || 'پوشاک ترنم'}
        />
      )}
      {post.breadcrumbEnabled !== false && (
        <BreadcrumbJsonLd
          items={[
            { name: 'خانه', url: `${WHOLESALE_ORIGIN}/` },
            { name: 'وبلاگ', url: `${WHOLESALE_ORIGIN}/blog` },
            { name: post.title, url },
          ]}
        />
      )}
      {post.faqSchemaEnabled && faqVisible.length > 0 && <FaqJsonLd items={faqVisible} />}
      <HowToJsonLd howTo={howToLd} />
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
            {post.authorName && <span>{post.authorName}</span>}
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
        <BlogToc items={toc} tone="wholesale" />
        <article className="card space-y-4 p-6 sm:p-10">
          <p className="text-sm font-medium leading-loose text-gray-700">{post.excerpt}</p>
          <hr className="border-gray-100" />
          <BlogContent content={contentHtml} contentFormat={post.contentFormat} tone="wholesale" />
        </article>

        <BlogHowTo howTo={post.howToData} tone="wholesale" />

        {faqVisible.length > 0 && (
          <section className="card mt-10 p-6 sm:p-8">
            <h2 className="mb-4 text-base font-bold text-gray-900">پرسش‌های متداول</h2>
            <div className="space-y-4">
              {faqVisible.map((f, i) => (
                <div key={f.id || i} className="border-b border-gray-100 pb-4 last:border-0">
                  <h3 className="mb-1.5 text-sm font-semibold text-gray-900">{f.question}</h3>
                  <p className="text-sm leading-relaxed text-gray-600">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <BlogRelatedProducts articleId={String(post.id)} channel="WHOLESALE" tone="wholesale" />

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

        <BlogComments articleId={String(post.id)} enabled={post.commentsEnabled !== false} tone="wholesale" />

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

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Calendar, Clock, Tag, ArrowRight } from 'lucide-react';
import {
  fetchPost,
  fetchPosts,
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
import { RETAIL_ORIGIN } from '@/lib/seo';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(decodeURIComponent(slug), 'RETAIL');
  if (!post) return { title: 'مطلب یافت نشد', robots: { index: false } };
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt;
  const url = `${RETAIL_ORIGIN}/blog/${post.slug}`;
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
        : [{ url: '/og-retail.jpg', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: (post.twitterCard as 'summary_large_image') || 'summary_large_image',
      title: post.twitterTitle || title,
      description: post.twitterDescription || description,
      images: post.twitterImage || ogImage || undefined,
    },
  };
}

export default async function RetailBlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await fetchPost(decodeURIComponent(slug), 'RETAIL');
  if (!post) notFound();

  const { posts } = await fetchPosts({ channel: 'RETAIL', limit: 12 });
  const related = posts
    .filter((p) => p.slug !== post.slug && p.category === post.category)
    .slice(0, 3);
  const url = `${RETAIL_ORIGIN}/blog/${post.slug}`;
  const faqVisible = (post.faqItems || []).filter(
    (f) => f.isVisible !== false && f.question && f.answer,
  );
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
    <div className="min-h-screen bg-[#faf8f5]">
      <BlogAnalyticsTracker articleId={String(post.id)} />
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
            { name: 'خانه', url: `${RETAIL_ORIGIN}/` },
            { name: 'وبلاگ', url: `${RETAIL_ORIGIN}/blog` },
            { name: post.title, url },
          ]}
        />
      )}
      {post.faqSchemaEnabled && faqVisible.length > 0 && <FaqJsonLd items={faqVisible} />}
      <HowToJsonLd howTo={howToLd} />

      <section className="bg-gradient-to-bl from-[#2c1810] via-[#4a2c1a] to-[#6b3f24] py-12 text-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
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
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/60">
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

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {post.coverImage && (
          <div className="relative mb-8 aspect-[3/2] overflow-hidden rounded-2xl bg-stone-100">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
        )}

        <article className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 sm:p-10">
          <p className="text-sm font-medium leading-loose text-stone-700">{post.excerpt}</p>
          <hr className="border-stone-100" />
          <BlogContent content={post.content ?? ''} contentFormat={post.contentFormat} tone="retail" />
        </article>

        <BlogHowTo howTo={post.howToData} tone="retail" />

        {faqVisible.length > 0 && (
          <section className="mt-10 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
            <h2 className="mb-4 text-base font-bold text-stone-900">پرسش‌های متداول</h2>
            <div className="space-y-4">
              {faqVisible.map((f, i) => (
                <div key={f.id || i} className="border-b border-stone-100 pb-4 last:border-0">
                  <h3 className="mb-1.5 text-sm font-semibold text-stone-900">{f.question}</h3>
                  <p className="text-sm leading-relaxed text-stone-600">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {post.primaryCta && (
          <div className="mt-10 rounded-2xl bg-[#4a2c1a] p-8 text-center text-white">
            <h3 className="mb-2 text-lg font-bold">{post.primaryCta.title}</h3>
            {post.primaryCta.description && (
              <p className="mb-5 text-sm text-white/70">{post.primaryCta.description}</p>
            )}
            <Link
              href={post.primaryCta.buttonUrl}
              target={post.primaryCta.openInNewTab ? '_blank' : undefined}
              rel={post.primaryCta.openInNewTab ? 'noopener' : undefined}
              className="inline-block rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-[#2c1810] transition hover:bg-amber-400"
            >
              {post.primaryCta.buttonText}
            </Link>
          </div>
        )}

        <BlogRelatedProducts
          articleId={String(post.id)}
          channel="RETAIL"
          tone="retail"
          productBasePath="/products"
        />

        {related.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-base font-bold text-stone-900">مطالب مرتبط</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="rounded-xl border border-stone-200 bg-white p-4 transition hover:shadow-md"
                >
                  <span
                    className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor(r.category)}`}
                  >
                    {r.category}
                  </span>
                  <p className="text-xs font-bold leading-snug text-stone-900">{r.title}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <BlogComments articleId={String(post.id)} enabled={post.commentsEnabled !== false} tone="retail" />
      </div>
    </div>
  );
}

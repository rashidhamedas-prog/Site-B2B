import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  notFound,
  permanentRedirect,
  redirect,
} from 'next/navigation';
import {
  Calendar,
  Clock,
  Tag,
  ArrowRight,
} from 'lucide-react';

import {
  fetchPost,
  fetchPosts,
  fetchBlogRedirect,
  categoryColor,
  formatJalali,
  readTime,
  buildRobotsContent,
} from '@/lib/blog';

import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
} from '@/components/shared/JsonLd';

import { BlogContent } from '@/components/blog/BlogContent';
import {
  BlogHowTo,
  HowToJsonLd,
} from '@/components/blog/BlogHowTo';
import { BlogRelatedProducts } from '@/components/blog/BlogRelatedProducts';
import { BlogComments } from '@/components/blog/BlogComments';
import { BlogAnalyticsTracker } from '@/components/blog/BlogAnalyticsTracker';

import {
  BlogToc,
  extractToc,
  injectHeadingIds,
} from '@/components/blog/BlogToc';

import {
  BlogPrimaryCta,
  BlogTagChips,
} from '@/components/blog/BlogCtaTags';

import { WHOLESALE_ORIGIN } from '@/lib/seo';

export const revalidate = 300;

interface Props {
  params: Promise<{
    slug: string;
  }>;
}

async function resolveOrRedirect(slug: string) {
  const post = await fetchPost(slug, 'WHOLESALE');

  if (post) {
    return post;
  }

  const redirection = await fetchBlogRedirect(
    `/blog/${slug}`,
    'WHOLESALE',
  );

  if (!redirection) {
    return null;
  }

  /*
   * یک Page Component نمی‌تواند NextResponse برگرداند.
   * بنابراین آدرس‌هایی که قبلاً با وضعیت 410 مدیریت می‌شدند،
   * در این صفحه به notFound منتقل می‌شوند.
   */
  if (
    redirection.statusCode === 410 ||
    redirection.destinationUrl === 'gone:410'
  ) {
    return 'GONE' as const;
  }

  const destination = redirection.destinationUrl.startsWith('http')
    ? redirection.destinationUrl
    : redirection.destinationUrl.startsWith('/')
      ? redirection.destinationUrl
      : `/${redirection.destinationUrl}`;

  if (redirection.statusCode === 302) {
    redirect(destination);
  }

  permanentRedirect(destination);
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const post = await fetchPost(
    decodedSlug,
    'WHOLESALE',
  );

  if (!post) {
    return {
      title: 'مطلب یافت نشد',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = post.seoTitle || post.title;
  const description =
    post.seoDescription || post.excerpt;

  const url =
    `${WHOLESALE_ORIGIN}/blog/${post.slug}`;

  const ogImage =
    post.ogImage || post.coverImage;

  return {
    title,
    description,

    robots: buildRobotsContent(post),

    alternates: {
      canonical:
        post.canonicalType === 'CUSTOM' &&
        post.canonicalUrl
          ? post.canonicalUrl
          : post.canonicalType === 'NONE'
            ? undefined
            : url,
    },

    openGraph: {
      title: post.ogTitle || title,
      description:
        post.ogDescription || description,
      url,
      type: 'article',
      locale: 'fa_IR',

      images: ogImage
        ? [
            {
              url: ogImage,
              alt: title,
            },
          ]
        : [
            {
              url: '/og-wholesale.jpg',
              width: 1200,
              height: 630,
              alt: title,
            },
          ],
    },

    twitter: {
      card: 'summary_large_image',
      title: post.twitterTitle || title,
      description:
        post.twitterDescription || description,
      images:
        post.twitterImage ||
        ogImage ||
        undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: Props) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const resolved =
    await resolveOrRedirect(decodedSlug);

  /*
   * notFound دارای نوع never است؛ بنابراین اجرای صفحه
   * در همین نقطه متوقف می‌شود و Next.js صفحه 404 را نشان می‌دهد.
   */
  if (resolved === 'GONE') {
    notFound();
  }

  if (!resolved) {
    notFound();
  }

  const post = resolved;

  const { posts } = await fetchPosts({
    channel: 'WHOLESALE',
    limit: 12,
  });

  const related = posts
    .filter(
      (item) =>
        item.slug !== post.slug &&
        item.category === post.category,
    )
    .slice(0, 3);

  const url =
    `${WHOLESALE_ORIGIN}/blog/${post.slug}`;

  const faqVisible = (
    post.faqItems || []
  ).filter(
    (item) =>
      item.isVisible !== false &&
      item.question &&
      item.answer,
  );

  const toc =
    post.tableOfContentsEnabled !== false
      ? extractToc(
          post.content || '',
          post.tableOfContentsDepth || 3,
        )
      : [];

  const isHtmlContent =
    post.contentFormat === 'HTML' ||
    (post.content || '')
      .trim()
      .startsWith('<');

  const contentHtml =
    isHtmlContent && toc.length
      ? injectHeadingIds(
          post.content || '',
          toc,
        )
      : post.content || '';

  const howToLd =
    post.howToSchemaEnabled !== false &&
    post.howToData?.steps?.length
      ? {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: post.howToData.name,
          description:
            post.howToData.description,
          totalTime:
            post.howToData.totalTime,
          step: post.howToData.steps.map(
            (step, index) => ({
              '@type': 'HowToStep',
              position: index + 1,
              name: step.title,
              text: step.description,
            }),
          ),
        }
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <BlogAnalyticsTracker
        articleId={String(post.id)}
        title={post.title}
      />

      {post.articleSchemaEnabled !== false && (
        <ArticleJsonLd
          title={post.seoTitle || post.title}
          description={
            post.seoDescription ||
            post.excerpt
          }
          url={url}
          image={
            post.coverImage || undefined
          }
          datePublished={post.publishedAt}
          dateModified={post.updatedAt}
          authorName={
            post.authorName ||
            'پوشاک ترنم'
          }
        />
      )}

      {post.breadcrumbEnabled !== false && (
        <BreadcrumbJsonLd
          items={[
            {
              name: 'خانه',
              url: `${WHOLESALE_ORIGIN}/`,
            },
            {
              name: 'وبلاگ',
              url: `${WHOLESALE_ORIGIN}/blog`,
            },
            {
              name: post.title,
              url,
            },
          ]}
        />
      )}

      {post.faqSchemaEnabled &&
        faqVisible.length > 0 && (
          <FaqJsonLd
            items={faqVisible}
          />
        )}

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
            className={`mb-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${categoryColor(
              post.category,
            )}`}
          >
            <Tag className="h-3 w-3" />
            {post.category}
          </span>

          <h1 className="mb-4 text-2xl font-extrabold leading-snug sm:text-3xl">
            {post.title}
          </h1>

          <div className="flex items-center gap-4 text-xs text-white/60">
            {post.authorName && (
              <span>{post.authorName}</span>
            )}

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
        {post.coverImage ? (
          <div className="relative mb-8 aspect-[3/2] overflow-hidden border border-[color:var(--color-border)] bg-surface-muted">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
        ) : (
          <div className="mb-8 flex aspect-[3/2] items-center justify-center border border-[color:var(--color-border)] bg-surface-muted">
            <Tag className="h-10 w-10 text-primary/30" aria-hidden />
            <span className="sr-only">بدون تصویر کاور</span>
          </div>
        )}

        <BlogToc
          items={toc}
          tone="wholesale"
        />

        <article className="card space-y-4 p-6 sm:p-10">
          <p className="text-sm font-medium leading-loose text-gray-700">
            {post.excerpt}
          </p>

          <hr className="border-gray-100" />

          <BlogContent
            content={contentHtml}
            contentFormat={
              post.contentFormat
            }
            tone="wholesale"
          />

          <BlogTagChips
            tags={post.tags}
            articleId={String(post.id)}
            tone="wholesale"
          />
        </article>

        <BlogHowTo
          howTo={post.howToData}
          tone="wholesale"
        />

        {faqVisible.length > 0 && (
          <section className="card mt-10 p-6 sm:p-8">
            <h2 className="mb-4 text-base font-bold text-gray-900">
              پرسش‌های متداول
            </h2>

            <div className="space-y-4">
              {faqVisible.map(
                (item, index) => (
                  <div
                    key={
                      item.id || index
                    }
                    className="border-b border-gray-100 pb-4 last:border-0"
                  >
                    <h3 className="mb-1.5 text-sm font-semibold text-gray-900">
                      {item.question}
                    </h3>

                    <p className="text-sm leading-relaxed text-gray-600">
                      {item.answer}
                    </p>
                  </div>
                ),
              )}
            </div>
          </section>
        )}

        <BlogRelatedProducts
          articleId={String(post.id)}
          channel="WHOLESALE"
          tone="wholesale"
        />

        {related.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-base font-bold text-gray-900">
              مطالب مرتبط
            </h2>

            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/blog/${item.slug}`}
                  className="card group p-4 transition-shadow hover:shadow-md"
                >
                  <span
                    className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor(
                      item.category,
                    )}`}
                  >
                    {item.category}
                  </span>

                  <p className="text-xs font-bold leading-snug text-gray-900 transition-colors group-hover:text-primary">
                    {item.title}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <BlogComments
          articleId={String(post.id)}
          enabled={
            post.commentsEnabled !== false
          }
          tone="wholesale"
        />

        <BlogPrimaryCta
          articleId={String(post.id)}
          tone="wholesale"
          cta={post.primaryCta}
          fallback={{
            title:
              'خرید عمده مانتو مستقیم از تولیدی',
            description:
              'کاتالوگ کامل مدل‌های لینن و کتان ترنم را ببینید',
            buttonText:
              'مشاهده محصولات',
            buttonUrl: '/products',
          }}
        />
      </div>
    </div>
  );
}
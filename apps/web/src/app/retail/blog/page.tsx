import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Clock, ArrowLeft, Tag } from 'lucide-react';
import { fetchPosts, categoryColor, formatJalali, readTime } from '@/lib/blog';
import { RETAIL_ORIGIN } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'وبلاگ فروشگاه ترنم',
  description:
    'راهنمای خرید مانتو، استایل زنانه، سایزبندی و نگهداری لباس از فروشگاه پوشاک ترنم.',
  alternates: { canonical: `${RETAIL_ORIGIN}/blog` },
  openGraph: {
    title: 'وبلاگ فروشگاه ترنم',
    description: 'راهنمای خرید و استایل برای خریداران تکی.',
    url: `${RETAIL_ORIGIN}/blog`,
    images: [{ url: '/og-retail.jpg', width: 1200, height: 630, alt: 'وبلاگ ترنم' }],
  },
};

export const revalidate = 300;

export default async function RetailBlogPage() {
  const { posts } = await fetchPosts({ channel: 'RETAIL', limit: 12 });
  const categories = ['همه', ...Array.from(new Set(posts.map((p) => p.category).filter(Boolean)))];
  const [featured, ...rest] = posts;

  return (
    <div className="min-h-screen bg-[var(--color-bg, #faf8f5)]">
      <section className="border-b border-black/5 bg-gradient-to-bl from-[#2c1810] via-[#4a2c1a] to-[#6b3f24] py-14 text-white">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-amber-200/80">دانش خرید</p>
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight sm:text-4xl">وبلاگ ترنم</h1>
          <p className="mx-auto max-w-xl text-sm text-white/70 sm:text-base">
            راهنمای انتخاب مانتو، پارچه، سایز و استایل برای خرید مطمئن
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="mb-8 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
                cat === 'همه'
                  ? 'bg-[#4a2c1a] text-white'
                  : 'border border-black/10 bg-white text-stone-600'
              }`}
            >
              {cat}
            </span>
          ))}
        </div>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center">
            <p className="text-sm text-stone-500">هنوز مطلبی منتشر نشده است.</p>
          </div>
        ) : null}

        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="mb-10 block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md lg:flex"
          >
            <div className="relative min-h-[200px] bg-stone-100 lg:w-2/5">
              {featured.coverImage ? (
                <Image
                  src={featured.coverImage}
                  alt={featured.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  priority
                />
              ) : (
                <div className="flex h-full min-h-[200px] items-center justify-center bg-gradient-to-br from-[#4a2c1a] to-[#6b3f24] p-10 text-white">
                  <Tag className="h-10 w-10 text-amber-200/80" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-center p-6 sm:p-8">
              <span
                className={`mb-3 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${categoryColor(featured.category)}`}
              >
                {featured.category}
              </span>
              <h2 className="mb-2 text-xl font-bold leading-snug text-stone-900 sm:text-2xl">
                {featured.title}
              </h2>
              <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-stone-600">
                {featured.excerpt}
              </p>
              <div className="flex items-center gap-4 text-xs text-stone-400">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatJalali(featured)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {readTime(featured)}
                </span>
              </div>
            </div>
          </Link>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:shadow-md"
            >
              <div className="relative aspect-[16/10] bg-stone-100">
                {post.coverImage ? (
                  <Image
                    src={post.coverImage}
                    alt={post.title}
                    fill
                    className="object-cover transition group-hover:scale-[1.02]"
                    sizes="(max-width: 640px) 100vw, 33vw"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-stone-50">
                    <Tag className="h-6 w-6 text-stone-300" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <span
                  className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor(post.category)}`}
                >
                  {post.category}
                </span>
                <h3 className="mb-2 line-clamp-2 text-sm font-bold leading-snug text-stone-900 group-hover:text-[#4a2c1a]">
                  {post.title}
                </h3>
                <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-stone-500">{post.excerpt}</p>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#4a2c1a]">
                  ادامه مطلب
                  <ArrowLeft className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

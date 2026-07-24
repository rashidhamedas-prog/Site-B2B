import type { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, Clock, ArrowLeft, Tag } from 'lucide-react';
import { fetchPosts, categoryColor, formatJalali, readTime } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'وبلاگ ترنم',
  description:
    'نکته‌های واقعی برای بوتیک‌داران: خرید عمده، نگهداری لینن و کتان، و ترندهایی که در کارگاه خودمان می‌بینیم.',
  alternates: { canonical: 'https://poshaktaranom.com/blog' },
  openGraph: {
    title: 'وبلاگ پوشاک ترنم',
    description: 'راهنمای عمده‌فروشی و مراقبت از پوشاک زنانه.',
    url: 'https://poshaktaranom.com/blog',
    images: [{ url: '/og-wholesale.jpg', width: 1200, height: 630, alt: 'وبلاگ ترنم' }],
  },
};

export const revalidate = 300;

export default async function BlogPage() {
  const { posts } = await fetchPosts();
  const categories = ['همه', ...Array.from(new Set(posts.map((p) => p.category)))];
  const [featured, ...rest] = posts;

  return (
    <div className="min-h-screen bg-atmosphere">
      <section className="page-hero">
        <div className="container-site relative z-10 text-center">
          <p className="mb-3 text-sm font-semibold tracking-[0.15em] text-secondary">دانش عمده‌فروشی</p>
          <h1 className="mb-3 text-4xl font-extrabold tracking-tight">وبلاگ ترنم</h1>
          <p className="text-lg text-white/70">
            راهنمای خرید عمده، ترندهای فصلی و نکات کسب‌وکار برای بوتیک‌داران
          </p>
        </div>
      </section>

      <div className="container-site py-12 lg:py-14">
        <div className="mb-10 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                cat === 'همه'
                  ? 'bg-primary text-white'
                  : 'border border-[color:var(--color-border)] bg-white text-gray-600'
              }`}
            >
              {cat}
            </span>
          ))}
        </div>

        {featured && (
          <div className="mb-10 overflow-hidden border border-[color:var(--color-border)] bg-white lg:flex">
            <div className="flex min-h-[200px] items-center justify-center bg-gradient-brand p-12 lg:w-2/5">
              <div className="text-center text-white">
                <Tag className="mx-auto mb-3 h-10 w-10 text-secondary" />
                <p className="text-sm text-white/70">مقاله ویژه</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col justify-between p-8">
              <div>
                <span className={`mb-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${categoryColor(featured.category)}`}>
                  <Tag className="h-3 w-3" />{featured.category}
                </span>
                <h2 className="mb-3 text-xl font-bold leading-snug text-gray-900">{featured.title}</h2>
                <p className="mb-4 text-sm leading-relaxed text-gray-500">{featured.excerpt}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatJalali(featured)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{readTime(featured)}</span>
                </div>
                <Link href={`/blog/${featured.slug}`}
                  className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary transition-colors duration-200 hover:underline">
                  ادامه مطلب <ArrowLeft className="h-4 w-4 rtl-flip" />
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((post) => (
            <article key={post.slug} className="group overflow-hidden border border-[color:var(--color-border)] bg-white transition-shadow duration-250 hover:shadow-md">
              <div className="flex h-36 items-center justify-center bg-surface-muted">
                <Tag className="h-8 w-8 text-primary/30" />
              </div>
              <div className="p-5">
                <span className={`mb-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryColor(post.category)}`}>
                  <Tag className="h-3 w-3" />{post.category}
                </span>
                <h3 className="mb-2 text-sm font-bold leading-snug text-gray-900 transition-colors duration-200 group-hover:text-primary">
                  {post.title}
                </h3>
                <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-gray-500">{post.excerpt}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatJalali(post)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{readTime(post)}</span>
                  </div>
                  <Link href={`/blog/${post.slug}`}
                    className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    بیشتر <ArrowLeft className="h-3 w-3 rtl-flip" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14 bg-primary-dark p-8 text-center text-white sm:rounded-2xl">
          <h3 className="mb-2 text-xl font-bold">اطلاع‌رسانی کلکسیون جدید</h3>
          <p className="mb-5 text-sm text-white/70">
            برای دریافت اطلاعیه مدل‌های جدید و تخفیف‌های فصلی، شماره خود را ثبت کنید
          </p>
          <div className="mx-auto flex max-w-sm gap-2">
            <input
              type="tel"
              placeholder="شماره موبایل"
              className="flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
              dir="ltr"
            />
            <button className="cursor-pointer whitespace-nowrap rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-secondary-light">
              ثبت شماره
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

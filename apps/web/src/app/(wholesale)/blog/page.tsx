import type { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, Clock, ArrowLeft, Tag } from 'lucide-react';
import { fetchPosts, categoryColor, formatJalali, readTime } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'وبلاگ پوشاک ترنم | راهنمای خرید عمده، ترند پوشاک',
  description: 'مقالات تخصصی درباره خرید عمده مانتو زنانه، نگهداری لینن و کتان، ترندهای پوشاک و راهنمای بوتیک‌داران',
};

export const revalidate = 300;

export default async function BlogPage() {
  const { posts } = await fetchPosts();
  const categories = ['همه', ...Array.from(new Set(posts.map((p) => p.category)))];
  const [featured, ...rest] = posts;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-bl from-primary-dark via-primary to-primary-light text-white py-16">
        <div className="container-site text-center">
          <h1 className="text-4xl font-extrabold mb-3">وبلاگ ترنم</h1>
          <p className="text-white/70 text-lg">
            راهنمای خرید عمده، ترندهای فصلی و نکات کسب‌وکار برای بوتیک‌داران
          </p>
        </div>
      </section>

      <div className="container-site py-12">
        {/* Category chips */}
        <div className="flex flex-wrap gap-2 mb-10">
          {categories.map((cat) => (
            <span
              key={cat}
              className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                cat === 'همه'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {cat}
            </span>
          ))}
        </div>

        {/* Featured post */}
        {featured && (
          <div className="card overflow-hidden mb-8 lg:flex">
            <div className="lg:w-2/5 bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-12 min-h-[220px]">
              <div className="text-center text-white">
                <div className="text-6xl mb-3">📰</div>
                <p className="text-sm text-white/70">مقاله ویژه</p>
              </div>
            </div>
            <div className="p-8 flex-1 flex flex-col justify-between">
              <div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full mb-4 ${categoryColor(featured.category)}`}>
                  <Tag className="h-3 w-3" />{featured.category}
                </span>
                <h2 className="text-xl font-bold text-gray-900 mb-3 leading-snug">{featured.title}</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{featured.excerpt}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatJalali(featured)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{readTime(featured)}</span>
                </div>
                <Link href={`/blog/${featured.slug}`}
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  ادامه مطلب <ArrowLeft className="h-4 w-4 rtl-flip" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Grid posts */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((post) => (
            <article key={post.slug} className="card overflow-hidden group hover:shadow-md transition-shadow">
              <div className="h-36 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <span className="text-4xl opacity-40">📝</span>
              </div>
              <div className="p-5">
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full mb-3 ${categoryColor(post.category)}`}>
                  <Tag className="h-3 w-3" />{post.category}
                </span>
                <h3 className="font-bold text-gray-900 text-sm leading-snug mb-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-4 line-clamp-2">{post.excerpt}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatJalali(post)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{readTime(post)}</span>
                  </div>
                  <Link href={`/blog/${post.slug}`}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                    بیشتر <ArrowLeft className="h-3 w-3 rtl-flip" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Newsletter CTA */}
        <div className="mt-14 rounded-2xl bg-primary p-8 text-center text-white">
          <h3 className="text-xl font-bold mb-2">اطلاع‌رسانی کلکسیون جدید</h3>
          <p className="text-white/70 text-sm mb-5">
            برای دریافت اطلاعیه مدل‌های جدید و تخفیف‌های فصلی، شماره خود را ثبت کنید
          </p>
          <div className="flex max-w-sm mx-auto gap-2">
            <input
              type="tel"
              placeholder="شماره موبایل"
              className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
              dir="ltr"
            />
            <button className="px-5 py-2.5 rounded-xl bg-secondary text-white text-sm font-semibold hover:bg-secondary/90 transition-colors whitespace-nowrap">
              ثبت شماره
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

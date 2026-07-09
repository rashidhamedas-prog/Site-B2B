import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, Clock, Tag, ArrowRight } from 'lucide-react';
import { fetchPost, fetchPosts, categoryColor, formatJalali, readTime } from '@/lib/blog';

export const revalidate = 300;

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(decodeURIComponent(slug));
  if (!post) return { title: 'مطلب یافت نشد | وبلاگ ترنم' };
  return {
    title: post.seoTitle || `${post.title} | وبلاگ پوشاک ترنم`,
    description: post.seoDescription || post.excerpt,
  };
}

// Minimal markdown renderer: ## headings, ### subheadings, - bullets, paragraphs.
function renderMarkdown(md: string) {
  const blocks = md.split(/\n\n+/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (trimmed.startsWith('### ')) {
      return <h3 key={i} className="text-base font-bold text-gray-900 mt-6 mb-2">{trimmed.slice(4)}</h3>;
    }
    if (trimmed.startsWith('## ')) {
      return <h2 key={i} className="text-lg font-bold text-gray-900 mt-8 mb-3">{trimmed.slice(3)}</h2>;
    }
    if (trimmed.split('\n').every((l) => l.trim().startsWith('- '))) {
      return (
        <ul key={i} className="list-disc pr-5 space-y-1.5 text-sm text-gray-600 leading-relaxed">
          {trimmed.split('\n').map((l, j) => {
            const item = l.trim().slice(2);
            // Render **bold** segments inside list items.
            const parts = item.split(/\*\*(.+?)\*\*/g);
            return (
              <li key={j}>
                {parts.map((p, k) => (k % 2 === 1 ? <strong key={k} className="text-gray-800">{p}</strong> : p))}
              </li>
            );
          })}
        </ul>
      );
    }
    const parts = trimmed.split(/\*\*(.+?)\*\*/g);
    return (
      <p key={i} className="text-sm text-gray-600 leading-loose">
        {parts.map((p, k) => (k % 2 === 1 ? <strong key={k} className="text-gray-800">{p}</strong> : p))}
      </p>
    );
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await fetchPost(decodeURIComponent(slug));
  if (!post) notFound();

  const { posts } = await fetchPosts();
  const related = posts.filter((p) => p.slug !== post.slug && p.category === post.category).slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-bl from-primary-dark via-primary to-primary-light text-white py-14">
        <div className="container-site max-w-3xl">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white mb-5">
            <ArrowRight className="h-4 w-4" />
            بازگشت به وبلاگ
          </Link>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full mb-4 ${categoryColor(post.category)}`}>
            <Tag className="h-3 w-3" />{post.category}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-snug mb-4">{post.title}</h1>
          <div className="flex items-center gap-4 text-xs text-white/60">
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatJalali(post)}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{readTime(post)}</span>
          </div>
        </div>
      </section>

      <div className="container-site max-w-3xl py-10">
        {/* Body */}
        <article className="card p-6 sm:p-10 space-y-4">
          <p className="text-sm text-gray-700 leading-loose font-medium">{post.excerpt}</p>
          <hr className="border-gray-100" />
          {renderMarkdown(post.content ?? '')}
        </article>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-10">
            <h2 className="text-base font-bold text-gray-900 mb-4">مطالب مرتبط</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link key={r.slug} href={`/blog/${r.slug}`}
                  className="card p-4 hover:shadow-md transition-shadow group">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full mb-2 ${categoryColor(r.category)}`}>
                    {r.category}
                  </span>
                  <p className="text-xs font-bold text-gray-900 leading-snug group-hover:text-primary transition-colors">
                    {r.title}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 rounded-2xl bg-primary p-8 text-center text-white">
          <h3 className="text-lg font-bold mb-2">خرید عمده مانتو مستقیم از تولیدی</h3>
          <p className="text-white/70 text-sm mb-5">کاتالوگ کامل مدل‌های لینن و کتان ترنم را ببینید</p>
          <Link href="/products" className="inline-block px-6 py-2.5 rounded-xl bg-secondary text-white text-sm font-semibold hover:bg-secondary/90 transition-colors">
            مشاهده محصولات
          </Link>
        </div>
      </div>
    </div>
  );
}

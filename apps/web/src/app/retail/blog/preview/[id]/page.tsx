import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogContent } from '@/components/blog/BlogContent';

export const metadata: Metadata = {
  title: 'پیش‌نمایش مقاله',
  robots: { index: false, follow: false, nocache: true },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function RetailBlogPreviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token) notFound();

  try {
    const res = await fetch(`${API_URL}/blog/admin/posts/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) notFound();
    const post = await res.json();
    return (
      <div className="min-h-screen bg-amber-50">
        <div className="border-b border-amber-200 bg-amber-100 px-4 py-2 text-center text-xs text-amber-900">
          پیش‌نمایش — ایندکس نمی‌شود
        </div>
        <article className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="mb-4 text-2xl font-extrabold text-stone-900">{post.title}</h1>
          <p className="mb-6 text-sm text-stone-600">{post.excerpt}</p>
          <BlogContent content={post.content || ''} contentFormat={post.contentFormat} tone="retail" />
        </article>
      </div>
    );
  } catch {
    notFound();
  }
}

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { RETAIL_ORIGIN } from '@/lib/seo';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

async function fetchAuthor(slug: string) {
  try {
    const res = await fetch(`${API_URL}/blog/authors/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<{
      author: {
        displayName: string;
        slug: string;
        bio: string;
        avatarUrl?: string | null;
        jobTitle?: string | null;
        expertise?: string[];
        robotsIndex?: boolean;
      };
      posts: Array<{ slug: string; title: string; excerpt?: string }>;
    }>;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchAuthor(decodeURIComponent(slug));
  if (!data) return { title: 'نویسنده یافت نشد', robots: { index: false } };
  return {
    title: `${data.author.displayName} | نویسندگان ترنم`,
    description: data.author.bio?.slice(0, 160),
    robots: data.author.robotsIndex === false ? 'noindex,follow' : 'index,follow',
    alternates: { canonical: `${RETAIL_ORIGIN}/blog/author/${data.author.slug}` },
  };
}

export default async function RetailAuthorPage({ params }: Props) {
  const { slug } = await params;
  const data = await fetchAuthor(decodeURIComponent(slug));
  if (!data) notFound();
  const { author, posts } = data;

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <section className="bg-gradient-to-bl from-[#2c1810] via-[#4a2c1a] to-[#6b3f24] py-12 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center">
          {author.avatarUrl && (
            <div className="relative mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full">
              <Image src={author.avatarUrl} alt={author.displayName} fill className="object-cover" sizes="96px" />
            </div>
          )}
          <h1 className="mb-2 text-3xl font-extrabold">{author.displayName}</h1>
          {author.jobTitle && <p className="mb-3 text-sm text-amber-200/80">{author.jobTitle}</p>}
          <p className="text-sm text-white/75">{author.bio}</p>
        </div>
      </section>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h2 className="mb-5 text-lg font-bold text-stone-900">مقالات</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="rounded-xl border border-stone-200 bg-white p-4 hover:shadow-md">
              <h3 className="mb-1 text-sm font-bold text-stone-900">{p.title}</h3>
              <p className="line-clamp-2 text-xs text-stone-500">{p.excerpt}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

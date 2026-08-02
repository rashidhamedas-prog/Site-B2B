import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { WHOLESALE_ORIGIN } from '@/lib/seo';

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
        instagramUrl?: string | null;
        linkedinUrl?: string | null;
        websiteUrl?: string | null;
        robotsIndex?: boolean;
      };
      posts: Array<{ slug: string; title: string; excerpt?: string; publishedAt?: string }>;
    }>;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchAuthor(decodeURIComponent(slug));
  if (!data) return { title: 'نویسنده یافت نشد', robots: { index: false } };
  const url = `${WHOLESALE_ORIGIN}/blog/author/${data.author.slug}`;
  return {
    title: `${data.author.displayName} | نویسندگان ترنم`,
    description: data.author.bio?.slice(0, 160) || `مقالات ${data.author.displayName}`,
    robots: data.author.robotsIndex === false ? 'noindex,follow' : 'index,follow',
    alternates: { canonical: url },
  };
}

export default async function WholesaleAuthorPage({ params }: Props) {
  const { slug } = await params;
  const data = await fetchAuthor(decodeURIComponent(slug));
  if (!data) notFound();
  const { author, posts } = data;
  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.displayName,
    description: author.bio,
    jobTitle: author.jobTitle,
    url: `${WHOLESALE_ORIGIN}/blog/author/${author.slug}`,
    image: author.avatarUrl || undefined,
    sameAs: [author.instagramUrl, author.linkedinUrl, author.websiteUrl].filter(Boolean),
  };

  return (
    <div className="min-h-screen bg-atmosphere">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
      <section className="page-hero">
        <div className="container-site relative z-10 max-w-3xl text-center">
          {author.avatarUrl && (
            <div className="relative mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border-2 border-white/30">
              <Image src={author.avatarUrl} alt={author.displayName} fill className="object-cover" sizes="96px" />
            </div>
          )}
          <h1 className="mb-2 text-3xl font-extrabold">{author.displayName}</h1>
          {author.jobTitle && <p className="mb-3 text-sm text-secondary">{author.jobTitle}</p>}
          <p className="text-sm leading-relaxed text-white/75">{author.bio}</p>
          {author.expertise?.length ? (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {author.expertise.map((e) => (
                <span key={e} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                  {e}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>
      <div className="container-site max-w-4xl py-10">
        <h2 className="mb-5 text-lg font-bold text-gray-900">مقالات</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="card p-4 transition hover:shadow-md">
              <h3 className="mb-1 text-sm font-bold text-gray-900">{p.title}</h3>
              <p className="line-clamp-2 text-xs text-gray-500">{p.excerpt}</p>
            </Link>
          ))}
          {posts.length === 0 && <p className="text-sm text-gray-500">هنوز مقاله‌ای منتشر نشده.</p>}
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { asciiSlug } from '@taranom/persian-utils';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

function track(articleId: string | undefined, event: 'cta' | 'product' | 'internal') {
  if (!articleId) return;
  fetch(`${API_URL}/blog/article/${articleId}/analytics/${event}`, {
    method: 'POST',
    keepalive: true,
  }).catch(() => undefined);
  window.gtag?.('event', `blog_${event}_click`, {
    article_id: articleId,
    event_category: 'blog',
  });
}

export function BlogPrimaryCta({
  cta,
  articleId,
  tone = 'wholesale',
  fallback,
}: {
  cta?: {
    title: string;
    description?: string;
    buttonText: string;
    buttonUrl: string;
    openInNewTab?: boolean;
  } | null;
  articleId?: string;
  tone?: 'wholesale' | 'retail';
  fallback?: { title: string; description?: string; buttonText: string; buttonUrl: string };
}) {
  const data = cta?.buttonUrl ? cta : fallback;
  if (!data) return null;

  const wrap =
    tone === 'retail'
      ? 'mt-10 rounded-2xl bg-[#4a2c1a] p-8 text-center text-white'
      : 'mt-10 rounded-2xl bg-primary p-8 text-center text-white';
  const btn =
    tone === 'retail'
      ? 'inline-block rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-[#2c1810] transition hover:bg-amber-400'
      : 'inline-block rounded-xl bg-secondary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary/90';

  const openNew = 'openInNewTab' in data ? !!data.openInNewTab : false;

  return (
    <div className={wrap}>
      <h3 className="mb-2 text-lg font-bold">{data.title}</h3>
      {data.description && <p className="mb-5 text-sm text-white/70">{data.description}</p>}
      <Link
        href={data.buttonUrl}
        target={openNew ? '_blank' : undefined}
        rel={openNew ? 'noopener noreferrer' : undefined}
        className={btn}
        onClick={() => track(articleId, 'cta')}
      >
        {data.buttonText}
      </Link>
    </div>
  );
}

export function BlogTagChips({
  tags,
  articleId,
  tone = 'wholesale',
}: {
  tags?: string[] | null;
  articleId?: string;
  tone?: 'wholesale' | 'retail';
}) {
  if (!tags?.length) return null;
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {tags.map((tag) => {
        const slug = asciiSlug(tag, 'tag');
        return (
          <Link
            key={tag}
            href={`/blog/tag/${slug}`}
            className={
              tone === 'retail'
                ? 'rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] text-stone-600 hover:border-amber-300'
                : 'rounded-full bg-gray-100 px-3 py-1 text-[11px] text-gray-600 hover:bg-primary/10 hover:text-primary'
            }
            onClick={() => track(articleId, 'internal')}
          >
            #{tag}
          </Link>
        );
      })}
    </div>
  );
}

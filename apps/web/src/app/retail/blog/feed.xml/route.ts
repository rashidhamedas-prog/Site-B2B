import { NextResponse } from 'next/server';
import { fetchPosts } from '@/lib/blog';
import { RETAIL_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 600;

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const origin = RETAIL_ORIGIN;
  const { posts } = await fetchPosts({ channel: 'RETAIL', limit: 30 });
  const items = posts
    .map((p) => {
      const link = `${origin}/blog/${p.slug}`;
      const date = p.publishedAt ? new Date(p.publishedAt).toUTCString() : new Date().toUTCString();
      return `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid>${escapeXml(link)}</guid>
      <pubDate>${date}</pubDate>
      <description>${escapeXml(p.excerpt || '')}</description>
      ${p.category ? `<category>${escapeXml(p.category)}</category>` : ''}
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>وبلاگ فروشگاه ترنم</title>
    <link>${origin}/blog</link>
    <description>راهنمای خرید مانتو و استایل زنانه</description>
    <language>fa-IR</language>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    },
  });
}

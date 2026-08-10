'use client';

import { useEffect, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function emitGa4(event: string, articleId: string) {
  if (typeof window === 'undefined' || !window.gtag) return;
  const map: Record<string, string> = {
    view: 'blog_article_view',
    scroll25: 'blog_scroll_25',
    scroll50: 'blog_scroll_50',
    scroll75: 'blog_scroll_75',
    scroll90: 'blog_scroll_90',
    cta: 'blog_cta_click',
    product: 'blog_product_click',
    internal: 'blog_internal_click',
  };
  const name = map[event] || `blog_${event}`;
  window.gtag('event', name, {
    article_id: articleId,
    event_category: 'blog',
  });
}

function isFirstUniqueView(articleId: string): boolean {
  try {
    const key = `blog-uv:${articleId}`;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
    return true;
  } catch {
    return false;
  }
}

export function BlogAnalyticsTracker({
  articleId,
  title,
}: {
  articleId: string;
  title?: string;
}) {
  const sent = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!articleId) return;
    const track = (event: string, uniqueView = false) => {
      if (sent.current.has(event)) return;
      sent.current.add(event);
      const headers: Record<string, string> = {};
      if (uniqueView) headers['x-blog-uv'] = '1';
      fetch(`${API_URL}/blog/article/${articleId}/analytics/${event}`, {
        method: 'POST',
        keepalive: true,
        headers,
      }).catch((err) => {
        // Silent for visitors; observable in browser console / monitoring.
        console.warn('[blog-analytics]', event, err);
      });
      emitGa4(event, articleId);
    };

    track('view', isFirstUniqueView(articleId));
    if (title && window.gtag) {
      window.gtag('event', 'view_item', {
        item_name: title,
        item_id: articleId,
        item_category: 'blog',
      });
    }

    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = (window.scrollY / max) * 100;
      if (pct >= 25) track('scroll25');
      if (pct >= 50) track('scroll50');
      if (pct >= 75) track('scroll75');
      if (pct >= 90) track('scroll90');
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [articleId, title]);

  return null;
}

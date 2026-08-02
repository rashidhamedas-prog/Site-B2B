'use client';

import { useEffect, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

export function BlogAnalyticsTracker({ articleId }: { articleId: string }) {
  const sent = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!articleId) return;
    const track = (event: string) => {
      if (sent.current.has(event)) return;
      sent.current.add(event);
      fetch(`${API_URL}/blog/article/${articleId}/analytics/${event}`, {
        method: 'POST',
        keepalive: true,
      }).catch(() => undefined);
    };

    track('view');

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
  }, [articleId]);

  return null;
}

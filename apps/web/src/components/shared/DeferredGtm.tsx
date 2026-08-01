'use client';

import { useEffect } from 'react';
import { sanitizeGtmId } from '@/lib/google';

/**
 * Inject GTM after idle so it does not compete with LCP on landing pages.
 */
export function DeferredGtm({ gtmId }: { gtmId: string }) {
  const id = sanitizeGtmId(gtmId);

  useEffect(() => {
    if (!id || typeof window === 'undefined') return;
    if (document.getElementById('gtm-deferred')) return;

    const inject = () => {
      if (document.getElementById('gtm-deferred')) return;
      const w = window as Window & { dataLayer?: unknown[] };
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      const f = document.getElementsByTagName('script')[0];
      const j = document.createElement('script');
      j.id = 'gtm-deferred';
      j.async = true;
      j.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
      f?.parentNode?.insertBefore(j, f);
    };

    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;

    if (typeof ric === 'function') {
      ric(inject, { timeout: 4000 });
      return;
    }
    const t = window.setTimeout(inject, 2800);
    return () => window.clearTimeout(t);
  }, [id]);

  return null;
}

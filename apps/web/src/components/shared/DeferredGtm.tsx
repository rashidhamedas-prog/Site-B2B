'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  isAdminAnalyticsPath,
  isNonProductionAnalyticsHost,
  sanitizeGtmId,
} from '@/lib/google';
import { resolveGtmIdForHost } from '@/components/shared/GoogleTagManager';

/**
 * Inject GTM after idle so it does not compete with LCP on landing pages.
 * Host is resolved in the browser so the root layout can stay static (no headers()).
 * Skips admin routes and non-production hosts.
 */
export function DeferredGtm({ gtmId }: { gtmId?: string } = {}) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isAdminAnalyticsPath(pathname)) return;
    if (isNonProductionAnalyticsHost(window.location.hostname)) return;
    const id = sanitizeGtmId(gtmId) || resolveGtmIdForHost(window.location.hostname);
    if (!id) return;
    if (document.getElementById('gtm-deferred')) return;

    const inject = () => {
      if (document.getElementById('gtm-deferred')) return;
      if (isAdminAnalyticsPath(window.location.pathname)) return;
      if (isNonProductionAnalyticsHost(window.location.hostname)) return;
      const resolved = sanitizeGtmId(gtmId) || resolveGtmIdForHost(window.location.hostname);
      if (!resolved) return;
      const w = window as Window & { dataLayer?: unknown[] };
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      const f = document.getElementsByTagName('script')[0];
      const j = document.createElement('script');
      j.id = 'gtm-deferred';
      j.async = true;
      j.src = `https://www.googletagmanager.com/gtm.js?id=${resolved}`;
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
  }, [gtmId, pathname]);

  return null;
}

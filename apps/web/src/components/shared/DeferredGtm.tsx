'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  isAdminAnalyticsPath,
  isNonProductionAnalyticsHost,
  sanitizeGtmId,
} from '@/lib/google';
import { resolveGtmIdForHost } from '@/components/shared/GoogleTagManager';

const GTM_HARD_CAP_MS = 8000;
const FIRST_INTERACTION_EVENTS = ['pointerup', 'keydown'] as const;

/**
 * Inject GTM after load + a paint, or after the first completed interaction +
 * a paint. The hard cap preserves analytics on pages that stay idle while
 * keeping GTM execution out of the LCP and initial interaction tasks.
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

    let disposed = false;
    let scheduled = false;
    let firstFrame = 0;
    let secondFrame = 0;
    let paintFallback = 0;
    let hardCap = 0;

    const removeTriggers = () => {
      window.removeEventListener('load', scheduleAfterPaint);
      for (const event of FIRST_INTERACTION_EVENTS) {
        window.removeEventListener(event, scheduleAfterPaint);
      }
    };

    const inject = () => {
      if (disposed) return;
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
      if (f?.parentNode) {
        f.parentNode.insertBefore(j, f);
      } else {
        document.head.appendChild(j);
      }
    };

    function scheduleAfterPaint() {
      if (scheduled || disposed) return;
      scheduled = true;
      removeTriggers();
      window.clearTimeout(hardCap);

      if (typeof window.requestAnimationFrame !== 'function') {
        paintFallback = window.setTimeout(inject, 0);
        return;
      }
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(inject);
      });
    }

    window.addEventListener('load', scheduleAfterPaint, { once: true });
    for (const event of FIRST_INTERACTION_EVENTS) {
      window.addEventListener(event, scheduleAfterPaint, { once: true });
    }
    hardCap = window.setTimeout(scheduleAfterPaint, GTM_HARD_CAP_MS);
    if (document.readyState === 'complete') scheduleAfterPaint();

    return () => {
      disposed = true;
      removeTriggers();
      window.clearTimeout(hardCap);
      window.clearTimeout(paintFallback);
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [gtmId, pathname]);

  return null;
}

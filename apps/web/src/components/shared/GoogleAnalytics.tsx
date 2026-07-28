'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import {
  ga4EnvFor,
  gtmEnvFor,
  sanitizeGa4Id,
  sanitizeGtmId,
  type GoogleChannel,
} from '@/lib/google';

type MarketingPublic = {
  ga4WholesaleId?: string;
  ga4RetailId?: string;
  gtmWholesaleId?: string;
  gtmRetailId?: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function loadGtag(measurementId: string) {
  if (typeof window === 'undefined' || !measurementId) return;
  if (document.getElementById('ga4-gtag-src')) {
    window.gtag?.('config', measurementId, { send_page_view: false });
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false });

  const s = document.createElement('script');
  s.id = 'ga4-gtag-src';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(s);
}

function loadGtm(containerId: string) {
  if (typeof window === 'undefined' || !containerId) return;
  if (document.getElementById('gtm-script')) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const s = document.createElement('script');
  s.id = 'gtm-script';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
  document.head.appendChild(s);
}

function pagePath(pathname: string, search: string) {
  return `${pathname}${search ? `?${search}` : ''}`;
}

/**
 * Loads GA4 (and optional GTM) for the given storefront channel.
 * IDs: env NEXT_PUBLIC_GA4_* / NEXT_PUBLIC_GTM_* OR admin Settings → Google.
 */
export function GoogleAnalytics({ channel }: { channel: GoogleChannel }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const readyId = useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let ga4 = ga4EnvFor(channel);
      let gtm = gtmEnvFor(channel);
      try {
        const s = await apiClient.get<{ marketing?: MarketingPublic }>('/settings/public');
        const m = s.marketing ?? {};
        if (!ga4) {
          ga4 = sanitizeGa4Id(
            channel === 'RETAIL' ? m.ga4RetailId : m.ga4WholesaleId,
          );
        }
        if (!gtm) {
          gtm = sanitizeGtmId(
            channel === 'RETAIL' ? m.gtmRetailId : m.gtmWholesaleId,
          );
        }
      } catch {
        /* env-only fallback already applied */
      }
      if (cancelled) return;
      if (gtm) loadGtm(gtm);
      if (ga4) {
        loadGtag(ga4);
        readyId.current = ga4;
        const path = pagePath(pathname || '/', searchParams?.toString() || '');
        window.gtag?.('event', 'page_view', {
          page_path: path,
          page_title: document.title,
          send_to: ga4,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount to load scripts; path changes tracked below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  useEffect(() => {
    const id = readyId.current || ga4EnvFor(channel);
    if (!id || !window.gtag) return;
    const path = pagePath(pathname || '/', searchParams?.toString() || '');
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: typeof document !== 'undefined' ? document.title : path,
      send_to: id,
    });
  }, [pathname, searchParams, channel]);

  return null;
}

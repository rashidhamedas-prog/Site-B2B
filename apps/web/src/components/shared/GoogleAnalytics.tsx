'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { hostLooksRetail } from '@/lib/channel';
import {
  ga4EnvFor,
  ensureGtagStub,
  isAdminAnalyticsPath,
  isNonProductionAnalyticsHost,
  publicAnalyticsPagePath,
  sanitizeGa4Id,
  type GoogleChannel,
} from '@/lib/google';
import { setGa4RumiMeasurementId } from '@/components/shared/WebVitalsReporter';

type MarketingPublic = {
  ga4WholesaleId?: string;
  ga4RetailId?: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function bindGa4(measurementId: string) {
  if (typeof window === 'undefined' || !measurementId) return;
  ensureGtagStub();
}

function currentPublicPath(pathname: string, search: string) {
  if (typeof window !== 'undefined') {
    return publicAnalyticsPagePath(window.location.pathname, window.location.search);
  }
  return publicAnalyticsPagePath(pathname, search);
}

function channelAllowedOnHost(channel: GoogleChannel, host: string | null): boolean {
  const retail = hostLooksRetail(host);
  if (channel === 'RETAIL') return retail;
  return !retail;
}

/**
 * Sends SPA page_view through the GTM dataLayer / gtag stub.
 * Does not load gtag.js — GTM-NKBCGQJV is the single GA4 source of truth.
 */
export function GoogleAnalytics({ channel }: { channel: GoogleChannel }) {
  const pathname = usePathname();
  const readyId = useRef<string>('');
  const lastSent = useRef<string>('');

  const sendPageView = (id: string, path: string) => {
    const key = `${id}|${path}`;
    if (lastSent.current === key) return;
    lastSent.current = key;
    ensureGtagStub();
    const pageLocation =
      typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    const pageTitle = typeof document !== 'undefined' ? document.title : path;
    window.dataLayer?.push({
      event: 'page_view',
      page_path: path,
      page_location: pageLocation,
      page_title: pageTitle,
    });
    window.gtag?.('event', 'page_view', {
      page_path: path,
      page_location: pageLocation,
      page_title: pageTitle,
      send_to: id,
    });
  };

  useEffect(() => {
    if (isAdminAnalyticsPath(pathname)) return;
    const host = typeof window !== 'undefined' ? window.location.hostname : null;
    if (isNonProductionAnalyticsHost(host)) return;
    if (!channelAllowedOnHost(channel, host)) return;

    let cancelled = false;
    (async () => {
      let ga4 = ga4EnvFor(channel);
      try {
        const s = await apiClient.get<{ marketing?: MarketingPublic }>('/settings/public');
        const m = s.marketing ?? {};
        if (!ga4) {
          ga4 = sanitizeGa4Id(
            channel === 'RETAIL' ? m.ga4RetailId : m.ga4WholesaleId,
          );
        }
      } catch {
        /* env-only fallback already applied */
      }
      if (cancelled) return;
      if (ga4) {
        bindGa4(ga4);
        readyId.current = ga4;
        setGa4RumiMeasurementId(ga4);
        sendPageView(ga4, currentPublicPath(pathname || '/', ''));
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount to load scripts; path changes tracked below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  useEffect(() => {
    if (isAdminAnalyticsPath(pathname)) return;
    const host = typeof window !== 'undefined' ? window.location.hostname : null;
    if (isNonProductionAnalyticsHost(host)) return;
    if (!channelAllowedOnHost(channel, host)) return;
    const id = readyId.current || ga4EnvFor(channel);
    if (!id) return;
    ensureGtagStub();
    sendPageView(id, currentPublicPath(pathname || '/', ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, channel]);

  return null;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { hostLooksRetail } from '@/lib/channel';
import {
  ga4EnvFor,
  ensureGtagStub,
  isAdminAnalyticsPath,
  isNonProductionAnalyticsHost,
  pageViewDedupeKey,
  publicAnalyticsPagePath,
  RETAIL_GA4_MEASUREMENT_ID,
  sanitizeGa4Id,
  shouldSendPageView,
  type GoogleChannel,
} from '@/lib/google';
import { setGa4RumiMeasurementId } from '@/components/shared/WebVitalsReporter';
import { trackContactClick } from '@/lib/retail-analytics';

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
  const flagged = window as Window & { __taranomGa4Config?: Set<string> };
  if (!flagged.__taranomGa4Config) flagged.__taranomGa4Config = new Set();
  if (flagged.__taranomGa4Config.has(measurementId)) return;
  flagged.__taranomGa4Config.add(measurementId);
  window.gtag?.('config', measurementId, { send_page_view: false });
}

function isBlockedPath(pathname: string | null | undefined): boolean {
  if (isAdminAnalyticsPath(pathname)) return true;
  const p = pathname || '';
  return p === '/preview' || p.startsWith('/preview/') || p.includes('/preview/');
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
 * Sends one SPA page_view through the GTM-owned gtag command queue.
 * Does not load gtag.js. GTM is the single GA4 loader for this channel.
 */
export function GoogleAnalytics({ channel }: { channel: GoogleChannel }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? '';
  const [boundId, setBoundId] = useState('');
  const lastSent = useRef<string>('');

  const sendPageView = (id: string, path: string) => {
    const key = pageViewDedupeKey(id, path);
    if (!shouldSendPageView(lastSent.current, key)) return;
    lastSent.current = key;
    const flush = () => {
      ensureGtagStub();
      const pageLocation =
        typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
      const pageTitle = typeof document !== 'undefined' ? document.title : path;
      window.gtag?.('event', 'page_view', {
        page_path: path,
        page_location: pageLocation,
        page_title: pageTitle,
        send_to: id,
      });
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(flush));
    } else flush();
  };

  useEffect(() => {
    if (isBlockedPath(pathname)) return;
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
      if (!ga4 && channel === 'RETAIL') ga4 = RETAIL_GA4_MEASUREMENT_ID;
      if (cancelled) return;
      if (ga4) {
        bindGa4(ga4);
        setBoundId(ga4);
        setGa4RumiMeasurementId(ga4);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Load once; later path and search changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  useEffect(() => {
    if (isBlockedPath(pathname)) return;
    const host = typeof window !== 'undefined' ? window.location.hostname : null;
    if (isNonProductionAnalyticsHost(host)) return;
    if (!channelAllowedOnHost(channel, host)) return;
    const id = boundId;
    if (!id) return;
    ensureGtagStub();
    sendPageView(id, currentPublicPath(pathname || '/', search));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search, channel, boundId]);

  useEffect(() => {
    if (channel !== 'RETAIL') return;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      const href = anchor?.getAttribute('href') || '';
      if (!href) return;
      const method = contactMethodFromHref(href);
      if (method) trackContactClick(method);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [channel]);

  return null;
}

function contactMethodFromHref(href: string): string | null {
  const value = href.toLowerCase();
  if (value.startsWith('tel:')) return 'phone';
  if (value.startsWith('sms:') || value.startsWith('smsto:')) return 'sms';
  if (value.includes('wa.me') || value.includes('whatsapp.com')) return 'whatsapp';
  if (value.includes('t.me') || value.includes('telegram.')) return 'telegram';
  if (value.includes('instagram.com')) return 'instagram';
  if (value.includes('rubika.ir')) return 'rubika';
  if (value.includes('ble.ir')) return 'bale';
  return null;
}

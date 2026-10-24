'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { hostLooksRetail } from '@/lib/channel';
import {
  GA_PAGEVIEW_OWNER_ATTR,
  ga4EnvFor,
  ensureGtagStub,
  isAdminAnalyticsPath,
  isNonProductionAnalyticsHost,
  pageViewDedupeKey,
  publicAnalyticsPagePath,
  RETAIL_GA4_MEASUREMENT_ID,
  WHOLESALE_GA4_MEASUREMENT_ID,
  shouldSetTorobCampaignFields,
  sanitizeAnalyticsReferrer,
  sanitizeGa4Id,
  shouldSendPageView,
  type GoogleChannel,
} from '@/lib/google';
import { markGa4PageViewSent, setGa4RumiMeasurementId } from '@/components/shared/WebVitalsReporter';
import { trackContactClick, trackWholesaleLead } from '@/lib/retail-analytics';

const WHOLESALE_LEAD_BY_METHOD: Record<string, string> = {
  phone: 'phone_click',
  whatsapp: 'whatsapp_click',
  telegram: 'telegram_click',
};

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
  // Must precede the first config, or the GTM container's Google tag still sends its own page_view.
  // Only while this route owns page_view (every public layout mounts GoogleAnalyticsProvider).
  if (document.querySelector(`[${GA_PAGEVIEW_OWNER_ATTR}]`)) window.gtag?.('set', { send_page_view: false });
  window.gtag?.('config', measurementId, { send_page_view: false });
}

function isBlockedPath(pathname: string | null | undefined): boolean {
  if (isAdminAnalyticsPath(pathname)) return true;
  const p = pathname || '';
  return p === '/preview' || p.startsWith('/preview/') || p.includes('/preview/');
}

function currentPublicPath(pathname: string, search: string) {
  if (typeof window !== 'undefined') {
    return publicAnalyticsPagePath(window.location.pathname, window.location.search, {
      referrer: document.referrer,
    });
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
      const pageReferrer = sanitizeAnalyticsReferrer(document.referrer, window.location.hostname);
      const torob = shouldSetTorobCampaignFields({
        search: typeof window !== 'undefined' ? window.location.search : '',
        referrer: typeof document !== 'undefined' ? document.referrer : '',
      });
      // Later events on this page (e.g. purchase on /payment/callback) must not carry gateway tokens from the raw URL.
      const setFields: Record<string, string> = { page_location: pageLocation };
      if (pageReferrer) setFields.page_referrer = pageReferrer;
      if (torob) {
        setFields.campaign_source = torob.source;
        setFields.campaign_medium = torob.medium;
      }
      window.gtag?.('set', setFields);
      window.gtag?.('event', 'page_view', {
        page_path: path,
        page_location: pageLocation,
        page_title: pageTitle,
        send_to: id,
      });
      markGa4PageViewSent(id);
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

    const landingPath = currentPublicPath(pathname || '/', search);
    let cancelled = false;
    (async () => {
      let ga4 = ga4EnvFor(channel);
      if (!ga4) {
        // Admin override, capped so the first page_view is not late (late hit = empty landing page).
        try {
          const s = await Promise.race([
            apiClient.get<{ marketing?: MarketingPublic }>('/settings/public'),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
          ]);
          const m = s?.marketing ?? {};
          ga4 = sanitizeGa4Id(channel === 'RETAIL' ? m.ga4RetailId : m.ga4WholesaleId);
        } catch {
          /* fall back to the confirmed stream id below */
        }
      }
      if (!ga4 && channel === 'RETAIL') ga4 = RETAIL_GA4_MEASUREMENT_ID;
      if (!ga4 && channel === 'WHOLESALE') ga4 = WHOLESALE_GA4_MEASUREMENT_ID;
      if (!ga4) return;
      if (cancelled) {
        // Unmounted before binding (e.g. guest bounced from /checkout to a route without GA):
        // still record the landing page once. The shared ref dedupes Strict Mode remounts.
        if (!lastSent.current) {
          bindGa4(ga4);
          sendPageView(ga4, landingPath);
        }
        return;
      }
      bindGa4(ga4);
      setBoundId(ga4);
      setGa4RumiMeasurementId(ga4);
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
    // One capture listener per channel mount; cleaned up on unmount (Strict Mode safe).
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      const href = anchor?.getAttribute('href') || '';
      if (!href) return;
      const method = contactMethodFromHref(href);
      if (!method) return;
      if (channel === 'RETAIL') {
        trackContactClick(method);
        return;
      }
      const leadEvent = WHOLESALE_LEAD_BY_METHOD[method];
      if (!leadEvent) return;
      const location =
        anchor?.closest('[data-cta-location]')?.getAttribute('data-cta-location') || 'page_link';
      trackWholesaleLead(leadEvent, { cta_location: location.slice(0, 40) });
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

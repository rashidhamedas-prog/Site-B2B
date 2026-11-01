'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { GA_PAGEVIEW_OWNER_ATTR } from '@/lib/ga-pageview-owner';
import type { GoogleChannel } from '@/lib/google';

// Both render null; keeping them out of the shared layout chunk is safe because
// web-vitals observers use `buffered: true`.
const GoogleAnalytics = dynamic(
  () => import('@/components/shared/GoogleAnalytics').then((m) => m.GoogleAnalytics),
  { ssr: false },
);
const WebVitalsReporter = dynamic(
  () => import('@/components/shared/WebVitalsReporter').then((m) => m.WebVitalsReporter),
  { ssr: false },
);

/** Channel GA4 + RUM. Search changes stay inside this Suspense boundary. */
export function GoogleAnalyticsProvider({ channel }: { channel: GoogleChannel }) {
  return (
    <>
      {/* In the SSR HTML so DeferredGtm knows, before GTM loads, that the app owns page_view here. */}
      <span hidden {...{ [GA_PAGEVIEW_OWNER_ATTR]: channel }} />
      <Suspense fallback={null}>
        <GoogleAnalytics channel={channel} />
        <WebVitalsReporter channel={channel} />
      </Suspense>
    </>
  );
}

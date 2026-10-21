'use client';

import { Suspense } from 'react';
import { GoogleAnalytics } from '@/components/shared/GoogleAnalytics';
import { WebVitalsReporter } from '@/components/shared/WebVitalsReporter';
import { GA_PAGEVIEW_OWNER_ATTR, type GoogleChannel } from '@/lib/google';

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

'use client';

import { Suspense } from 'react';
import { GoogleAnalytics } from '@/components/shared/GoogleAnalytics';
import { WebVitalsReporter } from '@/components/shared/WebVitalsReporter';
import type { GoogleChannel } from '@/lib/google';

/** Channel GA4 + RUM. Search changes stay inside this Suspense boundary. */
export function GoogleAnalyticsProvider({ channel }: { channel: GoogleChannel }) {
  return (
    <Suspense fallback={null}>
      <GoogleAnalytics channel={channel} />
      <WebVitalsReporter channel={channel} />
    </Suspense>
  );
}

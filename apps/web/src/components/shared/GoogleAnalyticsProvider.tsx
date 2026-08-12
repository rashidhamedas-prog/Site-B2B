'use client';

import { Suspense } from 'react';
import { GoogleAnalytics } from '@/components/shared/GoogleAnalytics';
import { WebVitalsReporter } from '@/components/shared/WebVitalsReporter';
import type { GoogleChannel } from '@/lib/google';

/** Suspense wrapper — required because GoogleAnalytics uses useSearchParams. */
export function GoogleAnalyticsProvider({ channel }: { channel: GoogleChannel }) {
  return (
    <Suspense fallback={null}>
      <GoogleAnalytics channel={channel} />
      <WebVitalsReporter channel={channel} />
    </Suspense>
  );
}

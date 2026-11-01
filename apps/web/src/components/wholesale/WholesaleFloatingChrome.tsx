'use client';

import dynamic from 'next/dynamic';
import type { SiteChromeData } from '@/lib/cms/useSiteChrome';

// Both are position:fixed overlays, so loading them after hydration cannot shift layout.
const FloatingContact = dynamic(
  () => import('@/components/shared/FloatingContact').then((m) => m.FloatingContact),
  { ssr: false },
);
const ScrollToTop = dynamic(
  () => import('@/components/shared/ScrollToTop').then((m) => m.ScrollToTop),
  { ssr: false },
);

export function WholesaleFloatingChrome({ chrome }: { chrome: SiteChromeData | null }) {
  return (
    <>
      <FloatingContact chrome={chrome} />
      <ScrollToTop />
    </>
  );
}

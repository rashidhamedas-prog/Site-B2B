import type { ReactNode } from 'react';
import { CartProvider } from '@/lib/cart';
import { GoogleAnalyticsProvider } from '@/components/shared/GoogleAnalyticsProvider';

/**
 * `/checkout` sits outside the `(wholesale)` route group, so it needs its own
 * CartProvider after the provider was removed from the root layout (retail CWV),
 * and its own GA binding so checkout events survive a hard load of this page.
 */
export default function WholesaleCheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CartProvider>{children}</CartProvider>
      {/* Outside the cart tree: page_view must not depend on cart/auth branches. */}
      <GoogleAnalyticsProvider channel="WHOLESALE" />
    </>
  );
}

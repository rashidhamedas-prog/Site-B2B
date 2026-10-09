import type { ReactNode } from 'react';
import { CartProvider } from '@/lib/cart';

/**
 * `/checkout` sits outside the `(wholesale)` route group, so it needs its own
 * CartProvider after the provider was removed from the root layout (retail CWV).
 */
export default function WholesaleCheckoutLayout({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

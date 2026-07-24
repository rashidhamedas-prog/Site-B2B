import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'سبد خرید و پرداخت',
  robots: { index: false, follow: false },
};

export default function RetailCheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}

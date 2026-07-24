import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'حساب کاربری',
  robots: { index: false, follow: false },
};

export default function RetailAccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}

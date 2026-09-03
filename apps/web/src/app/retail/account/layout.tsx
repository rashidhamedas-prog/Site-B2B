import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RetailAccountFrame } from '@/components/retail/RetailAccountShell';

export const metadata: Metadata = {
  title: 'حساب کاربری',
  robots: { index: false, follow: false },
};

export default function RetailAccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-[var(--retail-muted)]">در حال بارگذاری حساب…</div>}>
      <RetailAccountFrame>{children}</RetailAccountFrame>
    </Suspense>
  );
}

'use client';

import { Suspense } from 'react';
import { RetailOtpLogin } from '@/components/retail/RetailOtpLogin';

export default function RetailAccountPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-[var(--retail-muted)]">در حال بارگذاری…</div>}>
      <RetailOtpLogin />
    </Suspense>
  );
}

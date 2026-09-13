import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminCustomerMarketing } from '@/components/admin/customer-marketing/AdminCustomerMarketing';

export const metadata: Metadata = { title: 'بازاریابی مشتریان' };

export default function CustomerMarketingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">در حال بارگذاری بازاریابی…</p>}>
      <AdminCustomerMarketing />
    </Suspense>
  );
}

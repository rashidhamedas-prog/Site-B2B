import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminCustomerRecord } from '@/components/admin/AdminCustomerRecord';

export const metadata: Metadata = { title: 'پرونده مشتری' };

export default function CustomerRecordPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">در حال بارگذاری پرونده…</p>}>
      <AdminCustomerRecord />
    </Suspense>
  );
}

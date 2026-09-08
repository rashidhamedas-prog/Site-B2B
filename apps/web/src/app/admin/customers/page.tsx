import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminCustomers } from '@/components/admin/AdminCustomers';

export const metadata: Metadata = { title: 'مشتریان' };

export default function CustomersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">در حال بارگذاری فهرست…</p>}>
      <AdminCustomers />
    </Suspense>
  );
}

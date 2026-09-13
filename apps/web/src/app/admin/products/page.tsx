import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminProducts } from '@/components/admin/AdminProducts';

export const metadata: Metadata = { title: 'محصولات' };

export default function ProductsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">در حال بارگذاری کاتالوگ…</p>}>
      <AdminProducts />
    </Suspense>
  );
}

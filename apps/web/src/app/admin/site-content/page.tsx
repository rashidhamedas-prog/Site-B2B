import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminSiteContent } from '@/components/admin/AdminSiteContent';

export const metadata: Metadata = {
  title: 'محتوای بصری | ادمین ترنم',
};

export default function AdminSiteContentRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">در حال بارگذاری محتوای سایت…</p>}>
      <AdminSiteContent />
    </Suspense>
  );
}

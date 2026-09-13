import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminSettings } from '@/components/admin/AdminSettings';

export const metadata: Metadata = { title: 'تنظیمات | پنل مدیریت ترنم' };

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">در حال بارگذاری تنظیمات…</p>}>
      <AdminSettings />
    </Suspense>
  );
}

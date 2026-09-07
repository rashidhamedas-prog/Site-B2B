import type { Metadata } from 'next';
import { AdminSettings } from '@/components/admin/AdminSettings';
import { AdminOpsPanels } from '@/components/admin/AdminOpsPanels';

export const metadata: Metadata = { title: 'تنظیمات | پنل مدیریت ترنم' };

export default function Page() {
  return (
    <div className="space-y-2">
      <AdminOpsPanels />
      <AdminSettings />
    </div>
  );
}

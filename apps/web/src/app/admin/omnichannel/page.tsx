import type { Metadata } from 'next';
import { AdminOmnichannel } from '@/components/admin/AdminOmnichannel';

export const metadata: Metadata = { title: 'کانال‌های انتشار | پنل مدیریت ترنم' };

export default function Page() {
  return <AdminOmnichannel />;
}

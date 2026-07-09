import type { Metadata } from 'next';
import { AdminNotifications } from '@/components/admin/AdminNotifications';
export const metadata: Metadata = { title: 'اعلان‌ها | پنل مدیریت ترنم' };
export default function Page() { return <AdminNotifications />; }

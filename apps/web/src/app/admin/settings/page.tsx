import type { Metadata } from 'next';
import { AdminSettings } from '@/components/admin/AdminSettings';
export const metadata: Metadata = { title: 'تنظیمات | پنل مدیریت ترنم' };
export default function Page() { return <AdminSettings />; }

import type { Metadata } from 'next';
import { AdminSmsSettings } from '@/components/admin/sms/AdminSmsRestPages';

export const metadata: Metadata = { title: 'تنظیمات پنل پیامک' };

export default function SmsSettingsPage() {
  return <AdminSmsSettings />;
}

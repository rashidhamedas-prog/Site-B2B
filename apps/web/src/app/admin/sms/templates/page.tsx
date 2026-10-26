import type { Metadata } from 'next';
import { AdminSmsTemplates } from '@/components/admin/sms/AdminSmsRestPages';

export const metadata: Metadata = { title: 'قالب‌های پیامک' };

export default function SmsTemplatesPage() {
  return <AdminSmsTemplates />;
}

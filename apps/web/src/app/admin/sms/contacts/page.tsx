import type { Metadata } from 'next';
import { AdminSmsContacts } from '@/components/admin/sms/AdminSmsRestPages';

export const metadata: Metadata = { title: 'مخاطبان پیامک' };

export default function SmsContactsPage() {
  return <AdminSmsContacts />;
}

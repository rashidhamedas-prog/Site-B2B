import type { Metadata } from 'next';
import { AdminSmsOptout } from '@/components/admin/sms/AdminSmsRestPages';

export const metadata: Metadata = { title: 'لغو و لیست سیاه' };

export default function SmsOptoutPage() {
  return <AdminSmsOptout />;
}

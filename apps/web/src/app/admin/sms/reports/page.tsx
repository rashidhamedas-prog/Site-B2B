import type { Metadata } from 'next';
import { AdminSmsReports } from '@/components/admin/sms/AdminSmsRestPages';

export const metadata: Metadata = { title: 'گزارش پیامک' };

export default function SmsReportsPage() {
  return <AdminSmsReports />;
}

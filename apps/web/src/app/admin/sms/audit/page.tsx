import type { Metadata } from 'next';
import { AdminSmsAudit } from '@/components/admin/sms/AdminSmsRestPages';

export const metadata: Metadata = { title: 'فعالیت پیامک' };

export default function SmsAuditPage() {
  return <AdminSmsAudit />;
}

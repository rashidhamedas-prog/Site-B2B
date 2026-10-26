import type { Metadata } from 'next';
import { AdminSmsDashboard } from '@/components/admin/sms/AdminSmsDashboard';

export const metadata: Metadata = { title: 'پنل پیامک' };

export default function SmsDashboardPage() {
  return <AdminSmsDashboard />;
}

import type { Metadata } from 'next';
import { CustomerDashboard } from '@/components/portal/CustomerDashboard';

export const metadata: Metadata = { title: 'داشبورد' };

export default function DashboardPage() {
  return <CustomerDashboard />;
}

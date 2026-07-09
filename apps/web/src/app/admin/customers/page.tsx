import type { Metadata } from 'next';
import { AdminCustomers } from '@/components/admin/AdminCustomers';

export const metadata: Metadata = { title: 'مشتریان' };

export default function CustomersPage() {
  return <AdminCustomers />;
}

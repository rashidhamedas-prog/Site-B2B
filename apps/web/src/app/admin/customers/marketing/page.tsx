import type { Metadata } from 'next';
import { AdminCustomerMarketing } from '@/components/admin/customer-marketing/AdminCustomerMarketing';

export const metadata: Metadata = { title: 'بازاریابی مشتریان' };

export default function CustomerMarketingPage() {
  return <AdminCustomerMarketing />;
}

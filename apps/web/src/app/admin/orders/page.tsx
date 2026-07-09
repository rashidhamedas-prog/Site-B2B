import type { Metadata } from 'next';
import { AdminOrders } from '@/components/admin/AdminOrders';

export const metadata: Metadata = { title: 'سفارش‌ها' };

export default function OrdersPage() {
  return <AdminOrders />;
}

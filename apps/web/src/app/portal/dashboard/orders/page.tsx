import type { Metadata } from 'next';
import { OrdersPage } from '@/components/portal/OrdersPage';

export const metadata: Metadata = { title: 'سفارش‌های من' };

export default function Orders() {
  return <OrdersPage />;
}

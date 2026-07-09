import type { Metadata } from 'next';
import { AdminOrderDetail } from '@/components/admin/AdminOrderDetail';

export const metadata: Metadata = { title: 'جزئیات سفارش | پنل مدیریت ترنم' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminOrderDetail id={id} />;
}

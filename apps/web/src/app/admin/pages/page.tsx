import type { Metadata } from 'next';
import { AdminPages } from '@/components/admin/AdminPages';

export const metadata: Metadata = {
  title: 'صفحات سایت | ادمین ترنم',
};

export default function AdminPagesRoute() {
  return <AdminPages />;
}

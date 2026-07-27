import type { Metadata } from 'next';
import { AdminSiteContent } from '@/components/admin/AdminSiteContent';

export const metadata: Metadata = {
  title: 'محتوای بصری | ادمین ترنم',
};

export default function AdminSiteContentRoute() {
  return <AdminSiteContent />;
}

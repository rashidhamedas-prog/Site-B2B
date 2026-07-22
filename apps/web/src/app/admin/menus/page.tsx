import type { Metadata } from 'next';
import { AdminMenus } from '@/components/admin/AdminMenus';

export const metadata: Metadata = {
  title: 'مدیریت منوها | ادمین ترنم',
};

export default function AdminMenusPage() {
  return <AdminMenus />;
}

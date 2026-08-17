import type { Metadata } from 'next';
import { AdminSeoRedirects } from '@/components/admin/AdminSeoRedirects';

export const metadata: Metadata = {
  title: 'سئو و ریدایرکت | پنل مدیریت ترنم',
};

export default function AdminSeoPage() {
  return <AdminSeoRedirects />;
}

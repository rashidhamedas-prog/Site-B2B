import type { Metadata } from 'next';
import { AdminPartners } from '@/components/admin/AdminPartners';

export const metadata: Metadata = { title: 'همکاران فروش | پنل مدیریت ترنم' };

export default function Page() {
  return <AdminPartners />;
}

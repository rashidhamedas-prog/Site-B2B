import type { Metadata } from 'next';
import { AdminAccount } from '@/components/admin/AdminAccount';

export const metadata: Metadata = { title: 'حساب من | پنل مدیریت ترنم' };

export default function Page() {
  return <AdminAccount />;
}

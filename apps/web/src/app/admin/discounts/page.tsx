import type { Metadata } from 'next';
import { AdminMarketing } from '@/components/admin/AdminMarketing';
export const metadata: Metadata = { title: 'تخفیف‌ها | پنل مدیریت ترنم' };
export default function Page() { return <AdminMarketing />; }

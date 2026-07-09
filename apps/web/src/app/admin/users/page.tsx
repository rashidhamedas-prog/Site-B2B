import type { Metadata } from 'next';
import { AdminUsers } from '@/components/admin/AdminUsers';
export const metadata: Metadata = { title: 'کاربران | پنل مدیریت ترنم' };
export default function Page() { return <AdminUsers />; }

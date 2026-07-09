import type { Metadata } from 'next';
import { AdminBlog } from '@/components/admin/AdminBlog';
export const metadata: Metadata = { title: 'وبلاگ | پنل مدیریت ترنم' };
export default function Page() { return <AdminBlog />; }

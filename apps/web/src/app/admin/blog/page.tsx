import type { Metadata } from 'next';
import { AdminBlogHub } from '@/components/admin/AdminBlogHub';

export const metadata: Metadata = { title: 'وبلاگ | پنل مدیریت ترنم' };

export default function Page() {
  return <AdminBlogHub />;
}

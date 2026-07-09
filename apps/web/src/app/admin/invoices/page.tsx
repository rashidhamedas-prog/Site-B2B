import type { Metadata } from 'next';
import { AdminInvoices } from '@/components/admin/AdminInvoices';
export const metadata: Metadata = { title: 'فاکتورها | پنل مدیریت ترنم' };
export default function Page() { return <AdminInvoices />; }

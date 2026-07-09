import type { Metadata } from 'next';
import { InvoicesPage } from '@/components/portal/InvoicesPage';

export const metadata: Metadata = { title: 'فاکتورها' };

export default function Invoices() {
  return <InvoicesPage />;
}

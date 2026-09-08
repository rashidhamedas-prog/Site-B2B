import type { Metadata } from 'next';
import { AdminCustomerDossier } from '@/components/admin/customer-marketing/AdminCustomerDossier';

export const metadata: Metadata = { title: 'پرونده مشتری' };

export default function CustomerDossierPage() {
  return <AdminCustomerDossier />;
}

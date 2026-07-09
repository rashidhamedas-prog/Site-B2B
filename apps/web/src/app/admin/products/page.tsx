import type { Metadata } from 'next';
import { AdminProducts } from '@/components/admin/AdminProducts';

export const metadata: Metadata = { title: 'محصولات' };

export default function ProductsPage() {
  return <AdminProducts />;
}

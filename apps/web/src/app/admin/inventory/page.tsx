import type { Metadata } from 'next';
import { AdminInventory } from '@/components/admin/AdminInventory';

export const metadata: Metadata = { title: 'مدیریت انبار | پوشاک ترنم' };

export default function InventoryPage() {
  return <AdminInventory />;
}

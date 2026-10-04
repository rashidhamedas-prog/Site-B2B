import type { Metadata } from 'next';
import { AdminBoutiqueReferrals } from '@/components/admin/AdminBoutiqueReferrals';

export const metadata: Metadata = { title: 'معرفی بوتیک' };

export default function Page() {
  return <AdminBoutiqueReferrals />;
}

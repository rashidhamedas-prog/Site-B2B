import type { Metadata } from 'next';
import { ReferralPanel } from '@/components/boutique-referral/ReferralPanel';

export const metadata: Metadata = { title: 'مسیر معرفی', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReferralPanel section="detail" introductionId={id} />;
}

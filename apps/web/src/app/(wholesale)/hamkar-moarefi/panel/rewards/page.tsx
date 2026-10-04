import type { Metadata } from 'next';
import { ReferralPanel } from '@/components/boutique-referral/ReferralPanel';

export const metadata: Metadata = { title: 'پاداش معرفی', robots: { index: false, follow: false } };

export default function Page() {
  return <ReferralPanel section="rewards" />;
}

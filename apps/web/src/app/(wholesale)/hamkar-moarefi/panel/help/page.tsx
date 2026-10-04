import type { Metadata } from 'next';
import { ReferralPanel } from '@/components/boutique-referral/ReferralPanel';

export const metadata: Metadata = { title: 'راهنما و اختلاف', robots: { index: false, follow: false } };

export default function Page() {
  return <ReferralPanel section="help" />;
}

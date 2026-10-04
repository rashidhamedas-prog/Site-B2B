import type { Metadata } from 'next';
import { ReferralPanel } from '@/components/boutique-referral/ReferralPanel';

export const metadata: Metadata = { title: 'معرفی‌ها', robots: { index: false, follow: false } };

export default function Page() {
  return <ReferralPanel section="introductions" />;
}

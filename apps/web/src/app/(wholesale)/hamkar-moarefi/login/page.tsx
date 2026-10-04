import type { Metadata } from 'next';
import { ReferralLoginForm } from '@/components/boutique-referral/ReferralLoginForm';

export const metadata: Metadata = { title: 'ورود همکار معرفی', robots: { index: false, follow: false } };

export default function ReferralLoginPage() {
  return <ReferralLoginForm />;
}

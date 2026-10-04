import type { Metadata } from 'next';
import { ReferralApplyForm } from '@/components/boutique-referral/ReferralApplyForm';

export const metadata: Metadata = {
  title: 'درخواست همکار معرفی',
  robots: { index: false, follow: false },
};

export default function ApplyPage() {
  return <ReferralApplyForm />;
}

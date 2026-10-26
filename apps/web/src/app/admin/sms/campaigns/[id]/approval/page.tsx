import type { Metadata } from 'next';
import { AdminSmsCampaignApproval } from '@/components/admin/sms/AdminSmsCampaignPages';

export const metadata: Metadata = { title: 'تأیید کمپین پیامک' };

export default function SmsCampaignApprovalPage() {
  return <AdminSmsCampaignApproval />;
}

import type { Metadata } from 'next';
import { AdminSmsCampaignRun } from '@/components/admin/sms/AdminSmsCampaignPages';

export const metadata: Metadata = { title: 'اجرای کمپین پیامک' };

export default function SmsCampaignRunPage() {
  return <AdminSmsCampaignRun />;
}

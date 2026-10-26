import type { Metadata } from 'next';
import { AdminSmsWizard } from '@/components/admin/sms/AdminSmsWizard';

export const metadata: Metadata = { title: 'ارسال انبوه پیامک' };

export default function SmsCampaignNewPage() {
  return <AdminSmsWizard />;
}

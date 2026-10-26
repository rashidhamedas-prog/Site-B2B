import type { Metadata } from 'next';
import { AdminSmsSend } from '@/components/admin/sms/AdminSmsSend';

export const metadata: Metadata = { title: 'ارسال تکی پیامک' };

export default function SmsSendPage() {
  return <AdminSmsSend />;
}

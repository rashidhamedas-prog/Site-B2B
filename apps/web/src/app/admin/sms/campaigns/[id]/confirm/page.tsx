import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'تأیید کمپین' };

export default async function SmsCampaignConfirmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm">
      <p>تأیید دومرحله‌ای در ویزارد ارسال انبوه انجام می‌شود.</p>
      <Link className="mt-3 inline-flex text-primary underline" href={`/admin/sms/campaigns/${id}`}>
        بازگشت به کمپین
      </Link>
      {' · '}
      <Link className="inline-flex text-primary underline" href="/admin/sms/campaigns/new">
        ویزارد جدید
      </Link>
    </div>
  );
}

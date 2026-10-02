'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpCard, SpEmpty, SpNote } from '@/components/sales-partners/SalesPartnerShell';
import { SpBadge, SpPageSkeleton } from '@/components/sales-partners/SpUi';

type Payout = {
  id: string;
  status: string;
  amountIrr: number;
  bankReferenceMasked: string | null;
  paidAt: string | null;
};

const PAYOUT_FA: Record<string, string> = {
  PAID: 'واریزشده',
  PENDING: 'در صف',
  FAILED: 'ناموفق',
  CANCELLED: 'لغو',
};

export default function SalesPartnerPayoutsPage() {
  const [rows, setRows] = useState<Payout[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Payout[]>('/sales-partners/payouts')
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری تسویه‌ها ناموفق بود'));
  }, []);

  return (
    <SalesPartnerShell title="تسویه">
      <SpNote>فقط واریزی که فروشگاه با مرجع بانکی ثبت کرده اینجا دیده می‌شود. درخواست برداشت دستی از این صفحه نیست.</SpNote>
      {!rows && !error && <SpPageSkeleton cards={2} />}
      {error && (
        <div className="mt-4">
          <SpAlert>{error}</SpAlert>
        </div>
      )}
      {rows && rows.length === 0 && !error && (
        <div className="mt-4 space-y-3">
          <SpEmpty>هنوز تسویه‌ای ثبت نشده است.</SpEmpty>
          <p className="text-sm leading-7 text-stone-600">
            شبا را در بخش حساب ثبت کنید تا وقتی مبلغ قابل‌برداشت به حد لازم برسد، فروشگاه بتواند واریز کند.
          </p>
          <Link href="/sales-partners/profile" className="inline-flex text-sm font-medium text-[#1B5C4A] underline-offset-4 hover:underline">
            ثبت یا ویرایش شبا
          </Link>
        </div>
      )}
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {(rows || []).map((row) => (
          <li key={row.id}>
            <SpCard>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium tabular-nums text-stone-900">{toman(row.amountIrr)} تومان</p>
                <SpBadge status={row.status} label={PAYOUT_FA[row.status] || row.status} />
              </div>
              <p className="mt-2 text-sm text-stone-600">
                {row.bankReferenceMasked || 'بدون مرجع بانکی'}
                {row.paidAt
                  ? ` · ${new Date(row.paidAt).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium' })}`
                  : ''}
              </p>
            </SpCard>
          </li>
        ))}
      </ul>
    </SalesPartnerShell>
  );
}

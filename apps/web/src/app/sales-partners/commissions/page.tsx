'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpCard, SpNote, SpStatus } from '@/components/sales-partners/SalesPartnerShell';
import { SpKpi } from '@/components/sales-partners/SpUi';

type Balances = {
  held: number;
  available: number;
  paid: number;
  reversed: number;
  entries?: Array<{
    id: string;
    amountIrr: number;
    entryType: string;
    createdAt: string;
    reasonCode?: string | null;
  }>;
};

const ENTRY_FA: Record<string, string> = {
  COMMISSION_EARNED: 'پورسانت کسب‌شده',
  COMMISSION_REVERSAL: 'برگشت پورسانت',
  PAYOUT: 'تسویه',
  PAYOUT_REVERSAL: 'برگشت تسویه',
  MANUAL_ADJUSTMENT: 'تعدیل دستی',
};

export default function SalesPartnerCommissionsPage() {
  const [data, setData] = useState<Balances | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Balances>('/sales-partners/commissions')
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری پورسانت ناموفق بود'));
  }, []);

  return (
    <SalesPartnerShell title="پورسانت">
      <SpNote>
        عدد این صفحه بعد از پرداخت سفارش ثبت می‌شود. تا تحویل و پایان نگهداری، قابل‌برداشت نیست. تخمین روی کارت محصول اینجا
        نیست.
      </SpNote>
      {!data && !error && (
        <div className="mt-4">
          <SpStatus>در حال بارگذاری…</SpStatus>
        </div>
      )}
      {error && (
        <div className="mt-4">
          <SpAlert>{error}</SpAlert>
        </div>
      )}
      {data && (
        <div className="mt-5 space-y-4">
          <section className="grid grid-cols-2 gap-2">
            <SpKpi label="در نگهداری" value={toman(data.held)} hint="تومان" />
            <SpKpi label="قابل‌برداشت" value={toman(data.available)} hint="تومان" accent />
            <SpKpi label="پرداخت‌شده" value={toman(data.paid)} hint="تومان" />
            <SpKpi label="برگشت‌خورده" value={toman(data.reversed)} hint="تومان" />
          </section>
          <div className="flex gap-2">
            <Link
              href="/sales-partners/payouts"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-stone-300 bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
            >
              سوابق تسویه
            </Link>
            <Link
              href="/sales-partners/reports"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-[#1B5C4A] px-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
            >
              گزارش کامل
            </Link>
          </div>
          {data.entries && data.entries.length > 0 ? (
            <ul className="space-y-2">
              {data.entries.slice(0, 20).map((row) => (
                <li key={row.id}>
                  <SpCard className="!p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{ENTRY_FA[row.entryType] || row.entryType}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {new Date(row.createdAt).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })}
                        </p>
                      </div>
                      <p className="shrink-0 tabular-nums text-sm font-semibold">
                        {toman(row.amountIrr)} تومان
                      </p>
                    </div>
                  </SpCard>
                </li>
              ))}
            </ul>
          ) : (
            <SpCard>
              <p className="text-sm text-stone-600">هنوز ردیف دفتری ثبت نشده است.</p>
            </SpCard>
          )}
        </div>
      )}
    </SalesPartnerShell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpCard, SpEmpty, SpNote, SpStatus } from '@/components/sales-partners/SalesPartnerShell';
import { SpBarRow, SpKpi } from '@/components/sales-partners/SpUi';
import { SP_DRAFT_STATUS_FA, formatSpDate } from '@/components/sales-partners/sp-labels';

type PartnerReport = {
  drafts: {
    total: number;
    byStatus: Record<string, number>;
    awaiting: number;
    converted: number;
    stale: number;
  };
  commissions: { held: number; available: number; paid: number; reversed: number };
  note: string;
  generatedAt: string;
};

export default function SalesPartnerReportsPage() {
  const [report, setReport] = useState<PartnerReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<PartnerReport>('/sales-partners/report')
      .then(setReport)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری گزارش ناموفق بود'));
  }, []);

  const max = report ? Math.max(1, ...Object.values(report.drafts.byStatus || { x: 1 })) : 1;

  return (
    <SalesPartnerShell title="گزارش">
      <SpNote>
        این صفحه فقط عملکرد حساب خود شما را نشان می‌دهد. اعداد قابل‌برداشت را با تخمین کارت محصول یکی نگیرید.
      </SpNote>
      {!report && !error && (
        <div className="mt-4">
          <SpStatus>در حال بارگذاری…</SpStatus>
        </div>
      )}
      {error && (
        <div className="mt-4">
          <SpAlert>{error}</SpAlert>
        </div>
      )}
      {report && (
        <div className="mt-5 space-y-4">
          <section className="grid grid-cols-2 gap-2" aria-label="پورسانت">
            <SpKpi label="نگهداری" value={`${toman(report.commissions.held)}`} hint="تومان" />
            <SpKpi label="قابل‌برداشت" value={`${toman(report.commissions.available)}`} hint="تومان" accent />
            <SpKpi label="پرداخت‌شده" value={`${toman(report.commissions.paid)}`} hint="تومان" />
            <SpKpi label="برگشت‌خورده" value={`${toman(report.commissions.reversed)}`} hint="تومان" />
          </section>

          <SpCard>
            <p className="font-medium">سفارش‌ها</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl bg-[#f6f3ee] p-2">
                <p className="text-xs text-stone-500">کل</p>
                <p className="font-semibold tabular-nums">{report.drafts.total.toLocaleString('fa-IR')}</p>
              </div>
              <div className="rounded-xl bg-[#f6f3ee] p-2">
                <p className="text-xs text-stone-500">منتظر</p>
                <p className="font-semibold tabular-nums">{report.drafts.awaiting.toLocaleString('fa-IR')}</p>
              </div>
              <div className="rounded-xl bg-[#f6f3ee] p-2">
                <p className="text-xs text-stone-500">تبدیل</p>
                <p className="font-semibold tabular-nums">{report.drafts.converted.toLocaleString('fa-IR')}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {Object.keys(report.drafts.byStatus).length === 0 ? (
                <SpEmpty>هنوز سفارشی برای گزارش نیست.</SpEmpty>
              ) : (
                Object.entries(report.drafts.byStatus).map(([key, value]) => (
                  <SpBarRow key={key} label={SP_DRAFT_STATUS_FA[key] || key} value={value} max={max} />
                ))
              )}
            </div>
          </SpCard>

          <p className="text-xs leading-6 text-stone-500" role="note">
            {report.note}
            {report.generatedAt ? ` · ${formatSpDate(report.generatedAt)}` : ''}
          </p>

          <div className="grid gap-2">
            <Link
              href="/sales-partners/commissions"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-stone-300 bg-white px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
            >
              جزئیات پورسانت
            </Link>
            <Link
              href="/sales-partners/orders"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-stone-300 bg-white px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
            >
              فهرست سفارش‌ها
            </Link>
          </div>
        </div>
      )}
    </SalesPartnerShell>
  );
}

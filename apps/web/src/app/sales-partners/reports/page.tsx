'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpCard, SpEmpty, SpNote, spSecondary } from '@/components/sales-partners/SalesPartnerShell';
import { SpBarRow, SpKpi, SpPageSkeleton } from '@/components/sales-partners/SpUi';
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
        فقط عملکرد حساب خودتان. عدد قابل‌برداشت را با تخمین کارت محصول یکی نگیرید.
      </SpNote>
      {!report && !error && <SpPageSkeleton />}
      {error && (
        <div className="mt-4">
          <SpAlert>{error}</SpAlert>
        </div>
      )}
      {report && (
        <div className="mt-5 space-y-4">
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="پورسانت">
            <SpKpi label="در انتظار آزادسازی" value={`${toman(report.commissions.held)}`} hint="تومان" />
            <SpKpi label="قابل‌برداشت" value={`${toman(report.commissions.available)}`} hint="تومان" accent />
            <SpKpi label="واریزشده" value={`${toman(report.commissions.paid)}`} hint="تومان" />
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
                <p className="text-xs text-stone-500">خرید</p>
                <p className="font-semibold tabular-nums">{report.drafts.converted.toLocaleString('fa-IR')}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {Object.keys(report.drafts.byStatus).length === 0 ? (
                <SpEmpty>هنوز سفارشی برای گزارش نیست. از محصولات لینک بفرستید.</SpEmpty>
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
            <Link href="/sales-partners/commissions" className={spSecondary}>
              جزئیات پورسانت
            </Link>
            <Link href="/sales-partners/orders" className={spSecondary}>
              فهرست سفارش‌ها
            </Link>
          </div>
        </div>
      )}
    </SalesPartnerShell>
  );
}

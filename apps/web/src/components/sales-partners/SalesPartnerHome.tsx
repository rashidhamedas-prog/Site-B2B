'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpCard, SpNote, SpStatus, spPrimary, spSecondary } from './SalesPartnerShell';
import { SpBadge, SpBarRow, SpKpi } from './SpUi';
import { spPartnerStatusLabel, SP_DRAFT_STATUS_FA } from './sp-labels';

type Me = {
  displayName: string;
  status: string;
  statusLabel: string;
  statusReason: string | null;
  phoneMasked: string;
};

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

export function SalesPartnerHome() {
  const [me, setMe] = useState<Me | null>(null);
  const [report, setReport] = useState<PartnerReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get<Me>('/sales-partners/me'),
      apiClient.get<PartnerReport>('/sales-partners/report'),
    ])
      .then(([nextMe, nextReport]) => {
        setMe(nextMe);
        setReport(nextReport);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'خطا در بارگذاری'))
      .finally(() => setLoading(false));
  }, []);

  const balances = report?.commissions;
  const draftMax = report
    ? Math.max(1, ...Object.values(report.drafts.byStatus || { x: 1 }))
    : 1;

  return (
    <SalesPartnerShell title="خانه">
      <SpNote>
        کار شما فرستادن لینک محصول است. خرید از همان لینک، بعد از پرداخت، پورسانت همان کالا را حساب می‌کند.
        مبلغ قابل‌برداشت جدا از تخمین روی کارت محصول است.
      </SpNote>
      {loading && (
        <div className="mt-6">
          <SpStatus>در حال بارگذاری…</SpStatus>
        </div>
      )}
      {error && (
        <div className="mt-6">
          <SpAlert>{error}</SpAlert>
        </div>
      )}
      {me && (
        <SpCard className="mt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{me.displayName}</p>
              <p className="mt-1 text-sm text-stone-600">{me.phoneMasked}</p>
            </div>
            <SpBadge status={me.status} label={spPartnerStatusLabel(me.status, me.statusLabel)} />
          </div>
          {me.statusReason && <p className="mt-3 text-sm text-amber-800">{me.statusReason}</p>}
          {me.status !== 'ACTIVE' && (
            <p className="mt-3 text-sm leading-7 text-stone-700">
              تا فعال شدن حساب، لینک فروش و سفارش جدید بسته است. اگر درخواست در بررسی است، منتظر تصمیم فروشگاه بمانید.
            </p>
          )}
        </SpCard>
      )}
      {balances && (
        <section className="mt-3 grid grid-cols-3 gap-2" aria-label="وضعیت پول">
          <SpKpi label="نگهداری" value={toman(balances.held)} hint="تومان" />
          <SpKpi label="قابل‌برداشت" value={toman(balances.available)} hint="تومان" accent />
          <SpKpi label="پرداخت‌شده" value={toman(balances.paid)} hint="تومان" />
        </section>
      )}
      {report && (
        <SpCard className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-stone-900">گزارش سریع شما</p>
            <Link
              href="/sales-partners/reports"
              className="text-xs text-[#1B5C4A] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
            >
              جزئیات
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p className="rounded-xl bg-[#f6f3ee] px-3 py-2">
              منتظر اقدام
              <span className="mt-0.5 block font-semibold tabular-nums">
                {report.drafts.awaiting.toLocaleString('fa-IR')}
              </span>
            </p>
            <p className="rounded-xl bg-[#f6f3ee] px-3 py-2">
              تبدیل‌شده
              <span className="mt-0.5 block font-semibold tabular-nums">
                {report.drafts.converted.toLocaleString('fa-IR')}
              </span>
            </p>
          </div>
          {Object.keys(report.drafts.byStatus).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(report.drafts.byStatus)
                .slice(0, 4)
                .map(([key, value]) => (
                  <SpBarRow key={key} label={SP_DRAFT_STATUS_FA[key] || key} value={value} max={draftMax} />
                ))}
            </div>
          ) : null}
        </SpCard>
      )}
      {report && report.drafts.stale > 0 && (
        <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm leading-7 text-amber-900" role="status">
          {report.drafts.stale.toLocaleString('fa-IR')} پیش‌سفارش قیمت یا موجودی‌اش عوض شده است. مبلغ نهایی هنگام تأیید
          مشتری از سرور محاسبه می‌شود.
        </p>
      )}
      <div className="mt-5 grid gap-2">
        <Link href="/sales-partners/catalog" className={spPrimary}>
          مشاهده محصولات و ارسال لینک
        </Link>
        <Link href="/sales-partners/orders/new" className={spSecondary}>
          سفارش برای مشتری
        </Link>
        <Link href="/sales-partners/reports" className={spSecondary}>
          داشبورد گزارش شخصی
        </Link>
      </div>
    </SalesPartnerShell>
  );
}

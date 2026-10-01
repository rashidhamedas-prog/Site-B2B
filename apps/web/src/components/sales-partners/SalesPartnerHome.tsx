'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Link2, ShoppingBag } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpCard, SpNote, spPrimary, spSecondary } from './SalesPartnerShell';
import { SpBadge, SpBarRow, SpKpi, SpPageSkeleton } from './SpUi';
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
  const canSell = me?.status === 'ACTIVE';

  return (
    <SalesPartnerShell title="خانه">
      <SpNote>
        لینک محصول را برای مشتری بفرستید. اگر از همان لینک خرید کند، پورسانت بعد از پرداخت ثبت می‌شود — مبلغ قابل‌برداشت
        جدا از تخمین روی کارت محصول است.
      </SpNote>
      {loading && <SpPageSkeleton />}
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
              <p className="mt-1 text-sm text-stone-600" dir="ltr">
                {me.phoneMasked}
              </p>
            </div>
            <SpBadge status={me.status} label={spPartnerStatusLabel(me.status, me.statusLabel)} />
          </div>
          {me.statusReason && <p className="mt-3 text-sm text-amber-800">{me.statusReason}</p>}
          {!canSell && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-7 text-amber-950">
              تا فعال شدن حساب، لینک فروش و سفارش جدید بسته است. اگر درخواست در بررسی است، منتظر تصمیم فروشگاه بمانید.
            </p>
          )}
        </SpCard>
      )}
      {balances && (
        <section className="mt-3 grid grid-cols-3 gap-2" aria-label="وضعیت پول">
          <SpKpi label="در انتظار آزادسازی" value={toman(balances.held)} hint="بعد از تحویل" />
          <SpKpi label="قابل‌برداشت" value={toman(balances.available)} hint="تومان" accent />
          <SpKpi label="واریزشده" value={toman(balances.paid)} hint="تومان" />
        </section>
      )}
      {report && (
        <SpCard className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-stone-900">نگاه سریع</p>
            <Link
              href="/sales-partners/reports"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#1B5C4A] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
            >
              جزئیات
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p className="rounded-xl bg-[#f6f3ee] px-3 py-2">
              منتظر مشتری
              <span className="mt-0.5 block font-semibold tabular-nums">
                {report.drafts.awaiting.toLocaleString('fa-IR')}
              </span>
            </p>
            <p className="rounded-xl bg-[#f6f3ee] px-3 py-2">
              خریدشده
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
          {report.drafts.stale.toLocaleString('fa-IR')} سفارش قیمت یا موجودی‌اش عوض شده. مبلغ نهایی هنگام تأیید مشتری از
          سرور خوانده می‌شود.
        </p>
      )}
      <div className="mt-5 grid gap-2">
        <Link href="/sales-partners/catalog" className={spPrimary} aria-disabled={!canSell}>
          <span className="inline-flex items-center gap-2">
            <Link2 className="h-4 w-4" aria-hidden />
            مشاهده محصولات و کپی لینک
          </span>
        </Link>
        <Link href="/sales-partners/orders/new" className={spSecondary}>
          <span className="inline-flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" aria-hidden />
            سفارش برای مشتری
          </span>
        </Link>
        <Link
          href="/sales-partners/guide"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-4 text-sm text-stone-700 transition-colors hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
        >
          آموزش کوتاه همکاری
        </Link>
      </div>
    </SalesPartnerShell>
  );
}

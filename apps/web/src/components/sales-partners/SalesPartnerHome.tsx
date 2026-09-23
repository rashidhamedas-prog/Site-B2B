'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpCard, SpNote, SpStatus, spPrimary, spSecondary } from './SalesPartnerShell';

type Me = {
  displayName: string;
  status: string;
  statusLabel: string;
  statusReason: string | null;
  phoneMasked: string;
};

type Draft = { id: string; status: string; statusLabel: string; stale?: boolean };
type Balances = { held: number; available: number; paid: number };

export function SalesPartnerHome() {
  const [me, setMe] = useState<Me | null>(null);
  const [awaiting, setAwaiting] = useState(0);
  const [staleCount, setStaleCount] = useState(0);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get<Me>('/sales-partners/me'),
      apiClient.get<Draft[]>('/sales-partners/orders'),
      apiClient.get<Balances>('/sales-partners/commissions'),
    ])
      .then(([nextMe, orders, nextBalances]) => {
        setMe(nextMe);
        setAwaiting(
          orders.filter((row) => row.status === 'DRAFT' || row.status === 'AWAITING_CUSTOMER_CONFIRMATION').length,
        );
        setStaleCount(orders.filter((row) => row.stale).length);
        setBalances(nextBalances);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'خطا در بارگذاری'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SalesPartnerShell title="خانه">
      <SpNote>
        کار شما فرستادن لینک محصول است. خرید از همان لینک، بعد از پرداخت، پورسانت همان کالا را حساب می‌کند.
        مبلغ قابل‌برداشت جدا از تخمین روی کارت محصول است.
      </SpNote>
      {loading && <div className="mt-6"><SpStatus>در حال بارگذاری…</SpStatus></div>}
      {error && <div className="mt-6"><SpAlert>{error}</SpAlert></div>}
      {me && (
        <SpCard className="mt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{me.displayName}</p>
              <p className="mt-1 text-sm text-stone-600">{me.phoneMasked}</p>
            </div>
            <p className="shrink-0 rounded-full bg-[#f6f3ee] px-3 py-1 text-xs text-[#1B5C4A]">{me.statusLabel}</p>
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
          <SpCard className="!p-3">
            <p className="text-xs text-stone-500">نگهداری</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{toman(balances.held)}</p>
            <p className="text-[11px] text-stone-500">تومان</p>
          </SpCard>
          <SpCard className="!border-[#1B5C4A] !p-3">
            <p className="text-xs text-[#1B5C4A]">قابل‌برداشت</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{toman(balances.available)}</p>
            <p className="text-[11px] text-stone-500">تومان</p>
          </SpCard>
          <SpCard className="!p-3">
            <p className="text-xs text-stone-500">پرداخت‌شده</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{toman(balances.paid)}</p>
            <p className="text-[11px] text-stone-500">تومان</p>
          </SpCard>
        </section>
      )}
      {staleCount > 0 && (
        <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm leading-7 text-amber-900" role="status">
          {staleCount} پیش‌سفارش قیمت یا موجودی‌اش عوض شده است. مبلغ نهایی هنگام تأیید مشتری از سرور محاسبه می‌شود.
        </p>
      )}
      {awaiting > 0 && (
        <p className="mt-3 text-sm text-stone-700">
          {awaiting} سفارش منتظر اقدام شما یا تأیید مشتری است.
        </p>
      )}
      <div className="mt-5 grid gap-2">
        <Link href="/sales-partners/catalog" className={spPrimary}>
          مشاهده محصولات و ارسال لینک
        </Link>
        <Link href="/sales-partners/orders/new" className={spSecondary}>
          سفارش برای مشتری
        </Link>
      </div>
    </SalesPartnerShell>
  );
}

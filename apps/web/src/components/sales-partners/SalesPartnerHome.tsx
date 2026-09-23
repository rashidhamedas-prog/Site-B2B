'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell } from './SalesPartnerShell';

type Me = {
  displayName: string;
  status: string;
  statusLabel: string;
  statusReason: string | null;
  phoneMasked: string;
};

type Draft = { id: string; status: string; statusLabel: string };
type Balances = { held: number; available: number; paid: number };

export function SalesPartnerHome() {
  const [me, setMe] = useState<Me | null>(null);
  const [awaiting, setAwaiting] = useState(0);
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
        setBalances(nextBalances);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'خطا در بارگذاری'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SalesPartnerShell title="خانه">
      <p className="text-sm text-stone-600">فروش ثبت‌شده با پورسانت قطعی یکی نیست.</p>
      {loading && <p className="mt-6 text-sm text-stone-600" role="status">در حال بارگذاری…</p>}
      {error && <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {me && (
        <section className="mt-6 rounded-2xl border border-stone-200 p-4">
          <p className="font-medium">{me.displayName}</p>
          <p className="mt-1 text-sm text-stone-600">{me.statusLabel} · {me.phoneMasked}</p>
          {me.statusReason && <p className="mt-2 text-sm text-amber-800">{me.statusReason}</p>}
          {me.status !== 'ACTIVE' && (
            <p className="mt-3 text-sm text-stone-700">
              فقط حساب فعال می‌تواند سفارش بسازد. اگر وضعیت شما در بررسی است، منتظر تصمیم ادمین بمانید.
            </p>
          )}
        </section>
      )}
      {balances && (
        <section className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <p className="rounded-xl border p-3">نیازمند اقدام: {awaiting}</p>
          <p className="rounded-xl border p-3">در نگهداری: {toman(balances.held)} تومان</p>
          <p className="rounded-xl border p-3">قابل‌برداشت: {toman(balances.available)} تومان</p>
          <p className="rounded-xl border p-3">پرداخت‌شده: {toman(balances.paid)} تومان</p>
        </section>
      )}
      <div className="mt-6 grid gap-2">
        <Link
          href="/sales-partners/catalog"
          className="min-h-11 rounded-xl bg-[#1B5C4A] px-4 py-3 text-center text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5C4A]"
        >
          دیدن محصولات قابل فروش
        </Link>
        <Link
          href="/sales-partners/orders/new"
          className="min-h-11 rounded-xl border border-stone-300 px-4 py-3 text-center text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1B5C4A]"
        >
          شروع سفارش جدید
        </Link>
      </div>
    </SalesPartnerShell>
  );
}

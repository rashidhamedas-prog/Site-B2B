'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { SalesPartnerShell } from './SalesPartnerShell';

type Me = {
  displayName: string;
  status: string;
  statusLabel: string;
  statusReason: string | null;
  phoneMasked: string;
};

export function SalesPartnerHome() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<Me>('/sales-partners/me')
      .then(setMe)
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

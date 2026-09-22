'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { clearToken } from '@/lib/auth';

type Me = {
  displayName: string;
  status: string;
  statusLabel: string;
  statusReason: string | null;
  phoneMasked: string;
};

const links = [
  { href: '/sales-partners/catalog', label: 'محصولات قابل فروش' },
  { href: '/sales-partners/orders/new', label: 'سفارش جدید' },
  { href: '/sales-partners/orders', label: 'سفارش‌های من' },
  { href: '/sales-partners/commissions', label: 'پورسانت‌ها' },
  { href: '/sales-partners/payouts', label: 'تسویه‌ها' },
  { href: '/sales-partners/profile', label: 'پروفایل' },
  { href: '/sales-partners/guide', label: 'آموزش و قوانین' },
];

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
    <main className="mx-auto min-h-screen max-w-lg px-4 py-6 text-right" dir="rtl">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">پنل همکار بازاریاب</h1>
          <p className="text-sm text-stone-600">فروش ثبت‌شده با پورسانت قطعی یکی نیست.</p>
        </div>
        <button
          type="button"
          className="min-h-11 rounded-xl border border-stone-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1B5C4A]"
          onClick={() => {
            clearToken();
            window.location.href = '/sales-partners/login';
          }}
        >
          خروج
        </button>
      </header>

      {loading && <p className="mt-6 text-sm text-stone-600" role="status">در حال بارگذاری…</p>}
      {error && <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {me && (
        <section className="mt-6 rounded-2xl border border-stone-200 p-4">
          <p className="font-medium">{me.displayName}</p>
          <p className="mt-1 text-sm text-stone-600">{me.statusLabel} · {me.phoneMasked}</p>
          {me.statusReason && <p className="mt-2 text-sm text-amber-800">{me.statusReason}</p>}
        </section>
      )}

      <nav className="mt-6 grid gap-2" aria-label="بخش‌های پنل همکار بازاریاب">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="min-h-11 rounded-xl border border-stone-200 px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1B5C4A]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}

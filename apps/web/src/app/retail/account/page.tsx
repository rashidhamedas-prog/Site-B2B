'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { RetailAccountAuth } from '@/components/retail/RetailAccountAuth';
import { safeAccountRedirect } from '@/lib/safe-redirect';

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: 'در بررسی',
  CONFIRMED: 'تأیید شد',
  PACKING: 'آماده‌سازی',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل',
  COMPLETED: 'تکمیل',
  CANCELLED: 'لغو',
  REFUNDED: 'بازپرداخت',
};

function toman(n: number) {
  return Math.round(Number(n) / 10).toLocaleString('fa-IR');
}

function RetailAccountHome() {
  const search = useSearchParams();
  const redirect = safeAccountRedirect(search.get('redirect'));
  const [loggedIn, setLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [wallet, setWallet] = useState(0);
  const [name, setName] = useState('');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const token = !!getToken();
    setLoggedIn(token);
    setReady(true);
    if (!token) return;
    (async () => {
      try {
        const [res, me] = await Promise.all([
          apiClient.get<{ data: OrderRow[] }>('/orders?limit=5&type=RETAIL_WEBSITE'),
          apiClient.get<{ ownerName?: string; businessName?: string; phone?: string; balance?: number }>(
            '/auth/me/profile',
          ),
        ]);
        setOrders(Array.isArray(res.data) ? res.data : []);
        setWallet(Number(me?.balance) || 0);
        setName(me?.ownerName || me?.businessName || me?.phone || '');
      } catch (err: unknown) {
        setLoadError(err instanceof Error ? err.message : 'بارگذاری حساب ناموفق بود');
        setOrders([]);
      }
    })();
  }, []);

  if (!ready) return <p className="text-sm text-[var(--retail-muted)]">در حال بارگذاری…</p>;
  if (!loggedIn) return <RetailAccountAuth redirect={redirect} />;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[var(--retail-primary)] px-5 py-5 text-white">
        <p className="text-xs font-bold opacity-80">سلام{name ? ` ${name}` : ''}</p>
        <p className="mt-2 text-xs font-bold opacity-80">اعتبار کیف‌پول</p>
        <p className="mt-1 text-2xl font-extrabold">{toman(wallet)} تومان</p>
        <p className="mt-1 text-xs opacity-70">در تسویه می‌توانید از اعتبار استفاده کنید</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/checkout" className="rounded-2xl bg-[var(--retail-gold)] px-4 py-3 text-center text-sm font-extrabold text-white">
          تسویه حساب
        </Link>
        <Link href="/products" className="rounded-2xl border px-4 py-3 text-center text-sm font-bold">
          ادامه خرید
        </Link>
        <Link href="/account/security" className="rounded-2xl bg-gray-100 px-4 py-3 text-center text-sm font-bold">
          تعیین یا تغییر رمز
        </Link>
      </div>

      {loadError ? <p className="text-sm text-red-600">{loadError}</p> : null}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">آخرین سفارش‌ها</h2>
          <Link href="/account/orders" className="text-sm font-bold text-[var(--retail-primary)]">
            همه سفارش‌ها
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--retail-muted)]">هنوز سفارشی ثبت نکرده‌اید.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.id}`} className="block rounded-2xl border border-[var(--retail-border)] bg-white p-4">
                  <div className="flex justify-between gap-2">
                    <p className="font-mono text-sm font-bold">{o.orderNumber}</p>
                    <p className="text-xs text-[var(--retail-muted)]">
                      {new Date(o.createdAt).toLocaleDateString('fa-IR')}
                    </p>
                  </div>
                  <p className="mt-1 text-sm">
                    {toman(o.total)} تومان — {STATUS_LABEL[o.status] || o.status}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function RetailAccountPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--retail-muted)]">در حال بارگذاری…</p>}>
      <RetailAccountHome />
    </Suspense>
  );
}

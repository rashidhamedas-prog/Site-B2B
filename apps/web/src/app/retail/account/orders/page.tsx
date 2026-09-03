'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  trackingCode?: string | null;
};

const STATUS_STEPS = ['PENDING_REVIEW', 'CONFIRMED', 'PACKING', 'SHIPPED', 'DELIVERED'] as const;
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

export default function RetailOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ data: OrderRow[] }>('/orders?limit=30&type=RETAIL_WEBSITE')
      .then((res) => setOrders(Array.isArray(res.data) ? res.data : []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری سفارش‌ها ناموفق بود'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-[var(--retail-muted)]">در حال بارگذاری سفارش‌ها…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--retail-border)] p-8 text-center">
        <p className="text-sm text-[var(--retail-muted)]">سفارشی ندارید.</p>
        <Link href="/products" className="mt-4 inline-block rounded-full bg-[var(--retail-gold)] px-5 py-2.5 text-sm font-extrabold text-white">
          مشاهده محصولات
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">سفارش‌های من</h2>
      {orders.map((o) => {
        const idx = STATUS_STEPS.indexOf(o.status as (typeof STATUS_STEPS)[number]);
        return (
          <Link key={o.id} href={`/account/orders/${o.id}`} className="block rounded-2xl border border-[var(--retail-border)] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-bold">{o.orderNumber}</p>
              <p className="text-xs text-[var(--retail-muted)]">{new Date(o.createdAt).toLocaleDateString('fa-IR')}</p>
            </div>
            <p className="mt-1 text-sm">
              {toman(o.total)} تومان — {STATUS_LABEL[o.status] || o.status}
            </p>
            <ol className="mt-3 flex flex-wrap gap-2">
              {STATUS_STEPS.map((s, i) => (
                <li
                  key={s}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    idx >= 0 && i <= idx ? 'bg-[var(--retail-primary)] text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </li>
              ))}
            </ol>
          </Link>
        );
      })}
    </div>
  );
}

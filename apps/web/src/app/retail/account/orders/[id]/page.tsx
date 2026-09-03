'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

type OrderItem = {
  id: string;
  productName: string;
  sku?: string;
  color?: string;
  size?: string;
  quantity: number;
  totalPrice: number;
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  shippingFee: number;
  total: number;
  trackingCode?: string;
  notes?: string;
  createdAt: string;
  items: OrderItem[];
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

export default function RetailOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get<Order>(`/orders/${id}`)
      .then(setOrder)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'سفارش پیدا نشد'));
  }, [id]);

  if (error) {
    return (
      <div>
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/account/orders" className="mt-3 inline-block text-sm font-bold text-[var(--retail-primary)]">
          بازگشت به سفارش‌ها
        </Link>
      </div>
    );
  }
  if (!order) return <p className="text-sm text-[var(--retail-muted)]">در حال بارگذاری جزئیات…</p>;

  return (
    <div className="space-y-5">
      <Link href="/account/orders" className="text-sm font-bold text-[var(--retail-primary)]">
        بازگشت به سفارش‌ها
      </Link>
      <div>
        <h2 className="text-lg font-bold">{order.orderNumber}</h2>
        <p className="text-sm text-[var(--retail-muted)]">
          {new Date(order.createdAt).toLocaleDateString('fa-IR', { dateStyle: 'long' })} — {STATUS_LABEL[order.status] || order.status}
        </p>
      </div>
      {order.trackingCode ? (
        <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm">
          کد پیگیری: <span className="font-mono font-bold">{order.trackingCode}</span>
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-[var(--retail-border)] bg-white">
        <table className="w-full min-w-[360px] text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-right">محصول</th>
              <th className="px-4 py-3 text-right">رنگ/سایز</th>
              <th className="px-4 py-3 text-right">تعداد</th>
              <th className="px-4 py-3 text-right">جمع</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-4 py-3 font-bold">
                  {item.productName}
                  {item.sku ? <p className="text-xs font-normal text-gray-400">{item.sku}</p> : null}
                </td>
                <td className="px-4 py-3">{[item.color, item.size].filter(Boolean).join(' / ') || '—'}</td>
                <td className="px-4 py-3">{item.quantity}</td>
                <td className="px-4 py-3">{toman(item.totalPrice)} ت</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-1 border-t px-4 py-4 text-sm">
          <div className="flex justify-between">
            <span>ارسال</span>
            <span>{Number(order.shippingFee) === 0 ? 'رایگان' : `${toman(order.shippingFee)} ت`}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>مجموع</span>
            <span>{toman(order.total)} تومان</span>
          </div>
        </div>
      </div>
      {order.notes ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{order.notes}</p>
      ) : null}
    </div>
  );
}

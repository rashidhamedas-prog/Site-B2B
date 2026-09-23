'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell } from '@/components/sales-partners/SalesPartnerShell';

type OrderView = {
  id: string;
  status: string;
  statusLabel: string;
  customerPhoneMasked: string | null;
  customerName: string | null;
  merchandiseIrr: number;
  shippingFeeIrr: number;
  estimatedCommissionIrr: number;
  convertedOrderId: string | null;
  items: { id: string; name: string | null; quantity: number; lineTotalIrr: number }[];
};

export default function SalesPartnerOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    apiClient
      .get<OrderView>(`/sales-partners/orders/${params.id}`)
      .then(setRow)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'این سفارش در دسترس نیست'))
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <SalesPartnerShell title="جزئیات سفارش">
      <p className="text-sm text-stone-600">
        <Link href="/sales-partners/orders" className="underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1B5C4A]">
          بازگشت به سفارش‌ها
        </Link>
      </p>
      {loading && <p className="mt-4 text-sm text-stone-600" role="status">در حال بارگذاری…</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {row && (
        <section className="mt-4 space-y-3 text-sm">
          <p className="font-medium">{row.statusLabel}</p>
          {row.customerPhoneMasked && <p>مشتری: {row.customerPhoneMasked}</p>}
          {row.customerName && <p>نام ثبت‌شده: {row.customerName}</p>}
          <p>مبلغ کالا: {toman(row.merchandiseIrr)} تومان</p>
          <p>ارسال برآوردی: {toman(row.shippingFeeIrr)} تومان</p>
          <p>پورسانت تخمینی: {toman(row.estimatedCommissionIrr)} تومان</p>
          {row.convertedOrderId && (
            <p className="text-stone-600">
              سفارش فروشگاه ثبت شده است. ارسال و پرداخت با ترنم است. پورسانت تخمینی با مبلغ قابل‌برداشت یکی نیست.
            </p>
          )}
          <ul className="space-y-2">
            {row.items.map((item) => (
              <li key={item.id} className="rounded-xl border p-3">
                {item.name} × {item.quantity} — {toman(item.lineTotalIrr)} تومان
              </li>
            ))}
          </ul>
          <p className="text-stone-500">کد رهگیری را شما ثبت نمی‌کنید و تحویل را تأیید نمی‌کنید.</p>
        </section>
      )}
    </SalesPartnerShell>
  );
}

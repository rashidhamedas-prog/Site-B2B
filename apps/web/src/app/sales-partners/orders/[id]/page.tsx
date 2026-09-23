'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpCard, SpStatus } from '@/components/sales-partners/SalesPartnerShell';

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
  stale?: boolean;
  alerts?: string[];
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
      <p className="text-sm">
        <Link href="/sales-partners/orders" className="text-[#1B5C4A] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]">
          بازگشت به سفارش‌ها
        </Link>
      </p>
      {loading && <div className="mt-4"><SpStatus>در حال بارگذاری…</SpStatus></div>}
      {error && <div className="mt-4"><SpAlert>{error}</SpAlert></div>}
      {row && (
        <SpCard className="mt-4 space-y-3 text-sm">
          <p className="font-medium">{row.statusLabel}</p>
          {row.alerts?.map((alert) => (
            <p key={alert} className="rounded-lg bg-amber-50 p-3 text-amber-900" role="status">{alert}</p>
          ))}
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
        </SpCard>
      )}
    </SalesPartnerShell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpCard } from '@/components/sales-partners/SalesPartnerShell';
import { SpBadge, SpPageSkeleton } from '@/components/sales-partners/SpUi';
import { spDraftNextStep } from '@/components/sales-partners/sp-labels';

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
        <Link
          href="/sales-partners/orders"
          className="font-medium text-[#1B5C4A] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
        >
          بازگشت به سفارش‌ها
        </Link>
      </p>
      {loading && <SpPageSkeleton cards={2} />}
      {error && (
        <div className="mt-4">
          <SpAlert>{error}</SpAlert>
        </div>
      )}
      {row && (
        <SpCard className="mt-4 space-y-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-stone-900">{row.statusLabel}</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">{spDraftNextStep(row.status, row.stale)}</p>
            </div>
            <SpBadge status={row.status} label={row.statusLabel} />
          </div>
          {row.alerts?.map((alert) => (
            <p key={alert} className="rounded-xl bg-amber-50 p-3 text-amber-900" role="status">
              {alert}
            </p>
          ))}
          {row.customerPhoneMasked && (
            <p>
              مشتری: <span dir="ltr">{row.customerPhoneMasked}</span>
            </p>
          )}
          {row.customerName && <p>نام ثبت‌شده: {row.customerName}</p>}
          <div className="rounded-xl bg-[#f6f3ee] p-3 space-y-1">
            <p>مبلغ کالا: {toman(row.merchandiseIrr)} تومان</p>
            <p>ارسال برآوردی: {toman(row.shippingFeeIrr)} تومان</p>
            <p>پورسانت تخمینی: {toman(row.estimatedCommissionIrr)} تومان</p>
          </div>
          {row.convertedOrderId && (
            <p className="leading-7 text-stone-600">
              سفارش فروشگاه ثبت شده است. ارسال و پرداخت با ترنم است. پورسانت تخمینی با مبلغ قابل‌برداشت یکی نیست.
            </p>
          )}
          <ul className="space-y-2">
            {row.items.map((item) => (
              <li key={item.id} className="rounded-xl border border-stone-200 p-3">
                {item.name} × {item.quantity.toLocaleString('fa-IR')} — {toman(item.lineTotalIrr)} تومان
              </li>
            ))}
          </ul>
          <p className="text-stone-500">کد رهگیری را شما ثبت نمی‌کنید و تحویل را تأیید نمی‌کنید.</p>
        </SpCard>
      )}
    </SalesPartnerShell>
  );
}

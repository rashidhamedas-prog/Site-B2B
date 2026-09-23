'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpCard, SpEmpty, SpStatus } from '@/components/sales-partners/SalesPartnerShell';

type Draft = {
  id: string;
  statusLabel: string;
  merchandiseIrr: number;
  estimatedCommissionIrr: number;
  customerPhoneMasked: string | null;
  stale?: boolean;
  alerts?: string[];
};

export default function SalesPartnerOrdersPage() {
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Draft[]>('/sales-partners/orders')
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری سفارش‌ها ناموفق بود'));
  }, []);

  return (
    <SalesPartnerShell title="سفارش‌ها">
      {!rows && !error && <SpStatus>در حال بارگذاری…</SpStatus>}
      {error && <SpAlert>{error}</SpAlert>}
      {rows && rows.length === 0 && !error && <SpEmpty>هنوز سفارشی ثبت نشده است. از محصولات، لینک بفرستید یا برای مشتری سفارش بسازید.</SpEmpty>}
      <ul className="space-y-3">
        {(rows || []).map((row) => (
          <li key={row.id}>
            <SpCard>
              <p className="font-medium">{row.statusLabel}</p>
              {row.stale && row.alerts?.length ? (
                <p className="mt-2 text-sm text-amber-800" role="status">{row.alerts[0]}</p>
              ) : null}
              <p className="mt-2 text-sm text-stone-600">
                کالا {toman(row.merchandiseIrr)} تومان
                <span className="mx-1">·</span>
                پورسانت تخمینی {toman(row.estimatedCommissionIrr)} تومان
              </p>
              {row.customerPhoneMasked && <p className="mt-1 text-sm text-stone-500">{row.customerPhoneMasked}</p>}
              <Link
                href={`/sales-partners/orders/${row.id}`}
                className="mt-3 inline-flex min-h-11 items-center text-sm text-[#1B5C4A] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
              >
                جزئیات سفارش
              </Link>
            </SpCard>
          </li>
        ))}
      </ul>
    </SalesPartnerShell>
  );
}

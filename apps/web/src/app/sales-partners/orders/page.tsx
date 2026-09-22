'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell } from '@/components/sales-partners/SalesPartnerShell';

type Draft = {
  id: string;
  statusLabel: string;
  merchandiseIrr: number;
  estimatedCommissionIrr: number;
  customerPhoneMasked: string | null;
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
    <SalesPartnerShell title="سفارش‌های من">
      {!rows && !error && <p className="text-sm text-stone-600" role="status">در حال بارگذاری…</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {rows && rows.length === 0 && !error && <p className="text-sm text-stone-600">هنوز پیش‌سفارش یا سفارشی ندارید.</p>}
      <ul className="space-y-3">
        {(rows || []).map((row) => (
          <li key={row.id} className="rounded-xl border p-4 text-sm">
            <p className="font-medium">{row.statusLabel}</p>
            <p className="mt-1 text-stone-600">
              {toman(row.merchandiseIrr)} تومان · پورسانت تخمینی {toman(row.estimatedCommissionIrr)} تومان
            </p>
            {row.customerPhoneMasked && <p className="mt-1 text-stone-500">{row.customerPhoneMasked}</p>}
            <Link
              href={`/sales-partners/orders/${row.id}`}
              className="mt-3 inline-flex min-h-11 items-center text-[#1B5C4A] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1B5C4A]"
            >
              مشاهده جزئیات
            </Link>
          </li>
        ))}
      </ul>
    </SalesPartnerShell>
  );
}

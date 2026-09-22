'use client';

import { useEffect, useState } from 'react';
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
  const [rows, setRows] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Draft[]>('/sales-partners/orders')
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری سفارش‌ها ناموفق بود'));
  }, []);

  return (
    <SalesPartnerShell title="سفارش‌های من">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {rows.length === 0 && !error && <p className="text-sm text-stone-600">هنوز پیش‌سفارش یا سفارشی ندارید.</p>}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border p-4 text-sm">
            <p className="font-medium">{row.statusLabel}</p>
            <p className="mt-1 text-stone-600">
              {toman(row.merchandiseIrr)} تومان · پورسانت تخمینی {toman(row.estimatedCommissionIrr)} تومان
            </p>
            {row.customerPhoneMasked && <p className="mt-1 text-stone-500">{row.customerPhoneMasked}</p>}
          </li>
        ))}
      </ul>
    </SalesPartnerShell>
  );
}

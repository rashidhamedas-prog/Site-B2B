'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell } from '@/components/sales-partners/SalesPartnerShell';

type Payout = {
  id: string;
  status: string;
  amountIrr: number;
  bankReferenceMasked: string | null;
  paidAt: string | null;
};

export default function SalesPartnerPayoutsPage() {
  const [rows, setRows] = useState<Payout[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Payout[]>('/sales-partners/payouts')
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری تسویه‌ها ناموفق بود'));
  }, []);

  return (
    <SalesPartnerShell title="تسویه‌ها">
      <p className="text-sm text-stone-600">فقط واریزهای ثبت‌شده با مرجع بانکی اینجا دیده می‌شود.</p>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {rows.length === 0 && !error && <p className="mt-4 text-sm text-stone-600">هنوز تسویه‌ای ثبت نشده است.</p>}
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border p-4 text-sm">
            <p className="font-medium">{toman(row.amountIrr)} تومان · {row.status}</p>
            <p className="mt-1 text-stone-600">{row.bankReferenceMasked} {row.paidAt ? `· ${new Date(row.paidAt).toLocaleDateString('fa-IR')}` : ''}</p>
          </li>
        ))}
      </ul>
    </SalesPartnerShell>
  );
}

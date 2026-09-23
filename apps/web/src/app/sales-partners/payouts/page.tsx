'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpCard, SpEmpty, SpNote, SpStatus } from '@/components/sales-partners/SalesPartnerShell';

type Payout = {
  id: string;
  status: string;
  amountIrr: number;
  bankReferenceMasked: string | null;
  paidAt: string | null;
};

export default function SalesPartnerPayoutsPage() {
  const [rows, setRows] = useState<Payout[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Payout[]>('/sales-partners/payouts')
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری تسویه‌ها ناموفق بود'));
  }, []);

  return (
    <SalesPartnerShell title="تسویه">
      <SpNote>فقط واریزی که فروشگاه با مرجع بانکی ثبت کرده اینجا دیده می‌شود.</SpNote>
      {!rows && !error && <div className="mt-4"><SpStatus>در حال بارگذاری…</SpStatus></div>}
      {error && <div className="mt-4"><SpAlert>{error}</SpAlert></div>}
      {rows && rows.length === 0 && !error && <div className="mt-4"><SpEmpty>هنوز تسویه‌ای ثبت نشده است.</SpEmpty></div>}
      <ul className="mt-4 space-y-3">
        {(rows || []).map((row) => (
          <li key={row.id}>
            <SpCard>
            <p className="font-medium tabular-nums">{toman(row.amountIrr)} تومان · {row.status}</p>
            <p className="mt-1 text-stone-600">
              {row.bankReferenceMasked}{' '}
              {row.paidAt
                ? `· ${new Date(row.paidAt).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium' })}`
                : ''}
            </p>
            </SpCard>
          </li>
        ))}
      </ul>
    </SalesPartnerShell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell } from '@/components/sales-partners/SalesPartnerShell';

type Balances = {
  held: number;
  available: number;
  paid: number;
  reversed: number;
};

export default function SalesPartnerCommissionsPage() {
  const [data, setData] = useState<Balances | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Balances>('/sales-partners/commissions')
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری پورسانت ناموفق بود'));
  }, []);

  return (
    <SalesPartnerShell title="پورسانت‌ها">
      <p className="text-sm text-stone-600">
        پورسانت بعد از پرداخت معتبر ثبت می‌شود و تا پایان مهلت مرجوعی قابل‌برداشت نیست. عدد تخمینی اینجا نیست.
      </p>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {data && (
        <ul className="mt-5 space-y-2 text-sm">
          <li className="rounded-xl border p-3">در دوره نگهداری: {toman(data.held)} تومان</li>
          <li className="rounded-xl border p-3">قابل‌برداشت: {toman(data.available)} تومان</li>
          <li className="rounded-xl border p-3">پرداخت‌شده: {toman(data.paid)} تومان</li>
          <li className="rounded-xl border p-3">برگشت‌خورده: {toman(data.reversed)} تومان</li>
        </ul>
      )}
    </SalesPartnerShell>
  );
}

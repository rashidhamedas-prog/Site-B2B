'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpCard, SpNote, SpStatus } from '@/components/sales-partners/SalesPartnerShell';

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
    <SalesPartnerShell title="پورسانت">
      <SpNote>
        عدد این صفحه بعد از پرداخت سفارش ثبت می‌شود. تا تحویل و پایان نگهداری، قابل‌برداشت نیست.
        تخمین روی کارت محصول اینجا نیست.
      </SpNote>
      {!data && !error && <div className="mt-4"><SpStatus>در حال بارگذاری…</SpStatus></div>}
      {error && <div className="mt-4"><SpAlert>{error}</SpAlert></div>}
      {data && (
        <ul className="mt-5 space-y-2 text-sm">
          <li><SpCard>در نگهداری: <span className="tabular-nums font-medium">{toman(data.held)} تومان</span></SpCard></li>
          <li><SpCard className="!border-[#1B5C4A]">قابل‌برداشت: <span className="tabular-nums font-medium">{toman(data.available)} تومان</span></SpCard></li>
          <li><SpCard>پرداخت‌شده: <span className="tabular-nums font-medium">{toman(data.paid)} تومان</span></SpCard></li>
          <li><SpCard>برگشت‌خورده: <span className="tabular-nums font-medium">{toman(data.reversed)} تومان</span></SpCard></li>
        </ul>
      )}
    </SalesPartnerShell>
  );
}

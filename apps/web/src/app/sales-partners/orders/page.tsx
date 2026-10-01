'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpCard, SpEmpty, spPrimary } from '@/components/sales-partners/SalesPartnerShell';
import { SpBadge, SpPageSkeleton, spFocusClass } from '@/components/sales-partners/SpUi';
import { spDraftNextStep } from '@/components/sales-partners/sp-labels';
import { cn } from '@/lib/cn';

type Draft = {
  id: string;
  status: string;
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
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    apiClient
      .get<Draft[]>('/sales-partners/orders')
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری سفارش‌ها ناموفق بود'));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (filter === 'ALL') return rows;
    if (filter === 'AWAITING') {
      return rows.filter((row) => row.status === 'DRAFT' || row.status === 'AWAITING_CUSTOMER_CONFIRMATION');
    }
    if (filter === 'STALE') return rows.filter((row) => row.stale);
    return rows.filter((row) => row.status === filter);
  }, [rows, filter]);

  return (
    <SalesPartnerShell title="سفارش‌ها">
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { id: 'ALL', label: 'همه' },
          { id: 'AWAITING', label: 'منتظر مشتری' },
          { id: 'CONVERTED_TO_ORDER', label: 'خرید شده' },
          { id: 'STALE', label: 'نیاز به بازبینی' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            className={cn(
              'min-h-10 rounded-full px-3 text-sm transition-colors duration-200',
              spFocusClass,
              filter === f.id ? 'bg-[#1B5C4A] text-white' : 'bg-white text-stone-700',
            )}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {!rows && !error && <SpPageSkeleton cards={2} />}
      {error && <SpAlert>{error}</SpAlert>}
      {rows && filtered.length === 0 && !error && (
        <SpEmpty>سفارشی با این فیلتر نیست. از محصولات لینک بفرستید یا سفارش جدید بسازید.</SpEmpty>
      )}
      <ul className="space-y-3">
        {filtered.map((row) => (
          <li key={row.id}>
            <SpCard>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-stone-900">{row.statusLabel}</p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">{spDraftNextStep(row.status, row.stale)}</p>
                </div>
                <SpBadge status={row.status} label={row.statusLabel} />
              </div>
              {row.stale && row.alerts?.length ? (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
                  {row.alerts[0]}
                </p>
              ) : null}
              <p className="mt-3 text-sm text-stone-600">
                کالا {toman(row.merchandiseIrr)} تومان
                <span className="mx-1">·</span>
                پورسانت تخمینی {toman(row.estimatedCommissionIrr)} تومان
              </p>
              {row.customerPhoneMasked && (
                <p className="mt-1 text-sm text-stone-500" dir="ltr">
                  {row.customerPhoneMasked}
                </p>
              )}
              <Link
                href={`/sales-partners/orders/${row.id}`}
                className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[#1B5C4A] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
              >
                جزئیات سفارش
              </Link>
            </SpCard>
          </li>
        ))}
      </ul>
      <Link href="/sales-partners/orders/new" className={`${spPrimary} mt-4`}>
        سفارش جدید برای مشتری
      </Link>
    </SalesPartnerShell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

type RmaRow = {
  id: string;
  status: string;
  requestType: string;
  reason: string;
  createdAt: string;
};

const STATUS: Record<string, string> = {
  PENDING: 'در انتظار بررسی',
  APPROVED: 'تأیید شده',
  REJECTED: 'رد شده',
  COMPLETED: 'انجام شد',
};

export default function RetailAccountReturnsPage() {
  const [rows, setRows] = useState<RmaRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<RmaRow[] | { data: RmaRow[] }>('/rma/mine')
      .then((res) => setRows(Array.isArray(res) ? res : res.data || []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری مرجوعی ناموفق بود'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">درخواست‌های مرجوعی</h2>
        <Link href="/returns" className="rounded-full bg-[var(--retail-primary)] px-4 py-2 text-sm font-extrabold text-white">
          ثبت درخواست جدید
        </Link>
      </div>
      {loading ? <p className="text-sm text-[var(--retail-muted)]">در حال بارگذاری…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="text-sm text-[var(--retail-muted)]">هنوز درخواست مرجوعی ثبت نکرده‌اید.</p>
      ) : null}
      {rows.map((row) => (
        <div key={row.id} className="rounded-2xl border border-[var(--retail-border)] bg-white p-4 text-sm">
          <p className="font-bold">{row.requestType === 'EXCHANGE' ? 'تعویض' : 'مرجوعی'}</p>
          <p className="mt-1 text-[var(--retail-muted)]">{row.reason}</p>
          <p className="mt-2 text-xs">
            {STATUS[row.status] || row.status} — {new Date(row.createdAt).toLocaleDateString('fa-IR')}
          </p>
        </div>
      ))}
    </div>
  );
}

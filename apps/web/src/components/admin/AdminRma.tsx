'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

type RmaRow = {
  id: string;
  orderId: string;
  orderItemId: string;
  customerId: string;
  reason: string;
  requestType: string;
  requestedSize?: string;
  refundType: string;
  status: string;
  adminNote?: string;
  createdAt: string;
};

const STATUS_FA: Record<string, string> = {
  PENDING: 'در انتظار',
  APPROVED: 'تأیید شده',
  REJECTED: 'رد شده',
  COMPLETED: 'تکمیل',
};

export function AdminRma() {
  const [rows, setRows] = useState<RmaRow[]>([]);
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState('');
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const q = status ? `?status=${encodeURIComponent(status)}` : '';
      const data = await apiClient.get<RmaRow[]>(`/rma${q}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'خطا در بارگذاری');
      setRows([]);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const patch = async (id: string, next: string) => {
    setBusyId(id);
    setError('');
    try {
      await apiClient.patch(`/rma/${id}/status`, {
        status: next,
        adminNote: note[id] || undefined,
      });
      await load();
    } catch (e: any) {
      setError(e?.message || 'خطا در به‌روزرسانی');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مرجوعی و تعویض (RMA)</h1>
          <p className="mt-1 text-sm text-gray-500">تأیید مرجوعی اعتبار کیف‌پول را شارژ و موجودی سایز را برمی‌گرداند.</p>
        </div>
        <select
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="PENDING">در انتظار</option>
          <option value="APPROVED">تأیید</option>
          <option value="REJECTED">رد</option>
          <option value="COMPLETED">تکمیل</option>
        </select>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-right text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">تاریخ</th>
              <th className="px-4 py-3 font-semibold">نوع</th>
              <th className="px-4 py-3 font-semibold">دلیل</th>
              <th className="px-4 py-3 font-semibold">وضعیت</th>
              <th className="px-4 py-3 font-semibold">یادداشت ادمین</th>
              <th className="px-4 py-3 font-semibold">اقدام</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  درخواستی نیست
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString('fa-IR')}
                  </td>
                  <td className="px-4 py-3">
                    {r.requestType === 'EXCHANGE' ? 'تعویض' : 'مرجوعی'}
                    {r.requestedSize ? ` → ${r.requestedSize}` : ''}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">{r.reason}</td>
                  <td className="px-4 py-3 font-semibold">{STATUS_FA[r.status] || r.status}</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                      placeholder="یادداشت…"
                      value={note[r.id] ?? r.adminNote ?? ''}
                      onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'PENDING' ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => patch(r.id, 'APPROVED')}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          تأیید
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => patch(r.id, 'REJECTED')}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          رد
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => patch(r.id, 'COMPLETED')}
                        className="rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                      >
                        تکمیل
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

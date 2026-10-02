'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_FA,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_FA,
  SUPPORT_STATUS_FA,
  SUPPORT_STATUSES,
  type SupportTicketDetail,
  type SupportTicketRow,
} from '@/components/support/support-labels';

export function AdminSupportTickets() {
  const [rows, setRows] = useState<SupportTicketRow[]>([]);
  const [selected, setSelected] = useState<SupportTicketDetail | null>(null);
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [q, setQ] = useState('');
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [nextStatus, setNextStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (channel) params.set('channel', channel);
      if (q.trim()) params.set('q', q.trim());
      const qs = params.toString();
      const data = await apiClient.get<SupportTicketRow[]>(`/support/tickets${qs ? `?${qs}` : ''}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'خطا در بارگذاری');
      setRows([]);
    }
  };

  useEffect(() => {
    load();
  }, [status, channel]);

  const openTicket = async (id: string) => {
    setError('');
    try {
      const data = await apiClient.get<SupportTicketDetail>(`/support/tickets/${id}`);
      setSelected(data);
      setNextStatus(data.status);
      setReply('');
      setInternal(false);
    } catch (e: any) {
      setError(e?.message || 'خطا در جزئیات');
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    setError('');
    try {
      const updated = await apiClient.post<SupportTicketDetail>(`/support/tickets/${selected.id}/messages`, {
        body: reply,
        isInternal: internal,
        status: nextStatus && nextStatus !== selected.status ? nextStatus : undefined,
      });
      setSelected(updated);
      setReply('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'ارسال ناموفق');
    } finally {
      setBusy(false);
    }
  };

  const patchMeta = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const updated = await apiClient.patch<SupportTicketDetail>(`/support/tickets/${selected.id}`, {
        status: nextStatus || undefined,
      });
      setSelected(updated);
      await load();
    } catch (e: any) {
      setError(e?.message || 'به‌روزرسانی ناموفق');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">پشتیبانی تیکتی</h1>
          <p className="mt-1 text-sm text-gray-500">تیکت‌های مشتریان تک و عمده در یک میز واحد.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="جستجوی شماره/موضوع"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') load();
            }}
          />
          <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">همه کانال‌ها</option>
            <option value="RETAIL">تک‌فروشی</option>
            <option value="WHOLESALE">عمده</option>
          </select>
          <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">همه وضعیت‌ها</option>
            {SUPPORT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SUPPORT_STATUS_FA[s]}
              </option>
            ))}
          </select>
          <button type="button" onClick={load} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white">
            اعمال
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white lg:col-span-2">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-right text-xs text-gray-500">
              <tr>
                <th className="px-3 py-3 font-semibold">تیکت</th>
                <th className="px-3 py-3 font-semibold">کانال</th>
                <th className="px-3 py-3 font-semibold">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-10 text-center text-gray-400">
                    تیکتی نیست
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`cursor-pointer hover:bg-gray-50 ${selected?.id === r.id ? 'bg-amber-50' : ''}`}
                    onClick={() => openTicket(r.id)}
                  >
                    <td className="px-3 py-3">
                      <p className="font-mono text-[11px] text-gray-500">{r.publicNumber}</p>
                      <p className="font-semibold text-gray-900 line-clamp-1">{r.subject}</p>
                      <p className="text-[11px] text-gray-400">
                        {SUPPORT_CATEGORY_FA[r.category] || r.category} · {SUPPORT_PRIORITY_FA[r.priority] || r.priority}
                      </p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs">{r.channel === 'RETAIL' ? 'تک' : 'عمده'}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs">{SUPPORT_STATUS_FA[r.status] || r.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-3">
          {!selected ? (
            <p className="py-16 text-center text-sm text-gray-400">یک تیکت را از لیست انتخاب کنید</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-mono text-xs text-gray-500">{selected.publicNumber}</p>
                <h2 className="text-lg font-bold text-gray-900">{selected.subject}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {selected.channel === 'RETAIL' ? 'تک‌فروشی' : 'عمده'} · مشتری {selected.customerId?.slice(0, 8)}…
                  {selected.orderId ? ` · سفارش ${selected.orderId.slice(0, 8)}…` : ''}
                </p>
              </div>

              <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-lg bg-gray-50 p-3">
                {(selected.messages || []).map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      m.isInternal
                        ? 'border-amber-200 bg-amber-50'
                        : m.authorType === 'STAFF'
                          ? 'border-blue-100 bg-white'
                          : 'border-gray-200 bg-white'
                    }`}
                  >
                    <p className="text-[11px] text-gray-500">
                      {m.isInternal ? 'یادداشت داخلی' : m.authorType === 'STAFF' ? 'پشتیبان' : 'مشتری'} —{' '}
                      {new Date(m.createdAt).toLocaleString('fa-IR')}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-7">{m.body}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-gray-500">وضعیت</span>
                  <select className="w-full rounded-lg border border-gray-200 px-3 py-2" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                    {SUPPORT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {SUPPORT_STATUS_FA[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <button type="button" disabled={busy} onClick={patchMeta} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold">
                    فقط ذخیره وضعیت
                  </button>
                </div>
              </div>

              <textarea
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                rows={4}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="پاسخ به مشتری…"
              />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                یادداشت داخلی (فقط ادمین)
              </label>
              <button
                type="button"
                disabled={busy || !reply.trim()}
                onClick={sendReply}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'در حال ارسال…' : 'ارسال پاسخ'}
              </button>
              <p className="text-[11px] text-gray-400">
                دسته‌ها: {SUPPORT_CATEGORIES.map((c) => SUPPORT_CATEGORY_FA[c]).join(' · ')} · اولویت‌ها:{' '}
                {SUPPORT_PRIORITIES.map((p) => SUPPORT_PRIORITY_FA[p]).join(' · ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

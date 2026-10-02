'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_FA,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_FA,
  SUPPORT_STATUS_FA,
  type SupportTicketDetail,
  type SupportTicketRow,
} from './support-labels';

type Variant = 'retail' | 'wholesale';

type Props = {
  variant: Variant;
  listHref: string;
  detailHref: (id: string) => string;
  newHref: string;
  mode: 'list' | 'new' | 'detail';
  ticketId?: string;
};

export function AccountSupportTickets({ variant, listHref, detailHref, newHref, mode, ticketId }: Props) {
  const isRetail = variant === 'retail';
  const card = isRetail
    ? 'rounded-2xl border border-[var(--retail-border)] bg-white p-4'
    : 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm';
  const muted = isRetail ? 'text-[var(--retail-muted)]' : 'text-gray-500';
  const primaryBtn = isRetail
    ? 'rounded-full bg-[var(--retail-primary)] px-4 py-2 text-sm font-extrabold text-white'
    : 'rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white';
  const inputCls = isRetail
    ? 'w-full rounded-xl border border-[var(--retail-border)] px-3 py-2 text-sm'
    : 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm';

  const [rows, setRows] = useState<SupportTicketRow[]>([]);
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [priority, setPriority] = useState('NORMAL');
  const [orderId, setOrderId] = useState('');
  const [reply, setReply] = useState('');

  const loadList = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiClient.get<SupportTicketRow[] | { data: SupportTicketRow[] }>('/support/tickets/mine');
      setRows(Array.isArray(data) ? data : data.data || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'بارگذاری ناموفق بود');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setError('');
    setLoading(true);
    try {
      const data = await apiClient.get<SupportTicketDetail>(`/support/tickets/${id}`);
      setDetail(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'بارگذاری تیکت ناموفق بود');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'list') loadList();
    if (mode === 'detail' && ticketId) loadDetail(ticketId);
    if (mode === 'new') setLoading(false);
  }, [mode, ticketId, loadList, loadDetail]);

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await apiClient.post<SupportTicketDetail>('/support/tickets', {
        subject,
        body,
        category,
        priority,
        orderId: orderId.trim() || undefined,
      });
      window.location.href = detailHref(created.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ثبت تیکت ناموفق بود');
      setBusy(false);
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketId || !reply.trim()) return;
    setBusy(true);
    setError('');
    try {
      const updated = await apiClient.post<SupportTicketDetail>(`/support/tickets/${ticketId}/messages`, {
        body: reply,
      });
      setDetail(updated);
      setReply('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ارسال پاسخ ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'new') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">تیکت جدید</h2>
          <Link href={listHref} className={`text-sm ${muted}`}>
            بازگشت به لیست
          </Link>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <form onSubmit={createTicket} className={`${card} space-y-3`}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">موضوع</span>
            <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={200} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">دسته</span>
              <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                {SUPPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {SUPPORT_CATEGORY_FA[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">اولویت</span>
              <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {SUPPORT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {SUPPORT_PRIORITY_FA[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">شناسه سفارش (اختیاری)</span>
            <input className={inputCls} value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="فقط اگر مربوط به سفارش خاصی است" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">شرح مشکل</span>
            <textarea className={inputCls} rows={5} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={4000} />
          </label>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? 'در حال ثبت…' : 'ثبت تیکت'}
          </button>
        </form>
      </div>
    );
  }

  if (mode === 'detail') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">جزئیات تیکت</h2>
          <Link href={listHref} className={`text-sm ${muted}`}>
            بازگشت به لیست
          </Link>
        </div>
        {loading ? <p className={`text-sm ${muted}`}>در حال بارگذاری…</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {detail ? (
          <>
            <div className={card}>
              <p className="text-xs font-mono text-gray-500">{detail.publicNumber}</p>
              <p className="mt-1 text-base font-bold">{detail.subject}</p>
              <p className={`mt-2 text-xs ${muted}`}>
                {SUPPORT_STATUS_FA[detail.status] || detail.status} · {SUPPORT_CATEGORY_FA[detail.category] || detail.category} ·{' '}
                {SUPPORT_PRIORITY_FA[detail.priority] || detail.priority}
              </p>
            </div>
            <div className="space-y-3">
              {(detail.messages || []).map((m) => (
                <div
                  key={m.id}
                  className={`${card} ${m.authorType === 'STAFF' ? (isRetail ? 'border-[var(--retail-primary)]/30 bg-[var(--retail-primary)]/5' : 'border-primary/20 bg-primary/5') : ''}`}
                >
                  <p className={`text-xs ${muted}`}>
                    {m.authorType === 'STAFF' ? 'پشتیبانی' : 'شما'} — {new Date(m.createdAt).toLocaleString('fa-IR')}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{m.body}</p>
                </div>
              ))}
            </div>
            {detail.status !== 'CLOSED' ? (
              <form onSubmit={sendReply} className={`${card} space-y-3`}>
                <textarea
                  className={inputCls}
                  rows={4}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="پاسخ شما…"
                  required
                  maxLength={4000}
                />
                <button type="submit" disabled={busy} className={primaryBtn}>
                  {busy ? 'در حال ارسال…' : 'ارسال پاسخ'}
                </button>
              </form>
            ) : (
              <p className={`text-sm ${muted}`}>این تیکت بسته است. در صورت نیاز تیکت جدید باز کنید.</p>
            )}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">پشتیبانی و تیکت‌ها</h2>
        <Link href={newHref} className={primaryBtn}>
          تیکت جدید
        </Link>
      </div>
      {loading ? <p className={`text-sm ${muted}`}>در حال بارگذاری…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className={`text-sm ${muted}`}>هنوز تیکتی ثبت نکرده‌اید.</p>
      ) : null}
      {rows.map((row) => (
        <Link key={row.id} href={detailHref(row.id)} className={`${card} block transition hover:opacity-95`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-mono text-gray-500">{row.publicNumber}</p>
              <p className="mt-1 font-bold">{row.subject}</p>
              <p className={`mt-1 text-xs ${muted}`}>
                {SUPPORT_CATEGORY_FA[row.category] || row.category} — {new Date(row.updatedAt || row.createdAt).toLocaleDateString('fa-IR')}
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">
              {SUPPORT_STATUS_FA[row.status] || row.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

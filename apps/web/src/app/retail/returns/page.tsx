'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { getToken } from '@/lib/auth';

type RmaRow = {
  id: string;
  orderItemId: string;
  reason: string;
  requestType: string;
  requestedSize?: string;
  status: string;
  refundType: string;
  createdAt: string;
};

export default function RetailReturnsPage() {
  const [rows, setRows] = useState<RmaRow[]>([]);
  const [orderItemId, setOrderItemId] = useState('');
  const [reason, setReason] = useState('سایز کوچک است');
  const [requestType, setRequestType] = useState<'RETURN' | 'EXCHANGE'>('EXCHANGE');
  const [requestedSize, setRequestedSize] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  const load = async () => {
    if (!getToken()) return;
    try {
      const data = await apiClient.get<RmaRow[]>('/rma/mine');
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    setLoggedIn(!!getToken());
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (!getToken()) {
      window.location.href = '/retail/account?redirect=/retail/returns';
      return;
    }
    try {
      await apiClient.post('/rma', {
        orderItemId,
        reason,
        requestType,
        requestedSize: requestType === 'EXCHANGE' ? requestedSize : undefined,
        refundType: 'WALLET',
      });
      setMsg('درخواست ثبت شد');
      setOrderItemId('');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'خطا در ثبت درخواست');
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold">مرجوعی و تعویض سایز</h1>
      <p className="mt-3 text-sm leading-8 text-[var(--retail-muted)]">
        پس از تحویل سفارش می‌توانید مرجوعی یا تعویض سایز ثبت کنید. در مرجوعی، مبلغ با ۵٪ بونوس به کیف پول واریز می‌شود.
      </p>

      {!loggedIn ? (
        <Link href="/retail/account?redirect=/retail/returns" className="mt-6 inline-block font-bold text-[var(--retail-primary)]">
          ورود برای ثبت درخواست
        </Link>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl bg-white p-6 ring-1 ring-[var(--retail-border)]">
          <label className="block text-sm font-bold">شناسه قلم سفارش (order item id)</label>
          <input
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={orderItemId}
            onChange={(e) => setOrderItemId(e.target.value)}
            required
            placeholder="از جزئیات سفارش کپی کنید"
          />
          <label className="block text-sm font-bold">نوع درخواست</label>
          <div className="flex gap-2">
            {[
              { id: 'EXCHANGE' as const, label: 'تعویض سایز' },
              { id: 'RETURN' as const, label: 'مرجوعی' },
            ].map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setRequestType(o.id)}
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${
                  requestType === o.id ? 'border-[var(--retail-primary)] bg-[var(--retail-primary)] text-white' : ''
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {requestType === 'EXCHANGE' ? (
            <>
              <label className="block text-sm font-bold">سایز درخواستی</label>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={requestedSize}
                onChange={(e) => setRequestedSize(e.target.value)}
                placeholder="مثلاً L"
                required
              />
            </>
          ) : null}
          <label className="block text-sm font-bold">دلیل</label>
          <select
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option>سایز کوچک است</option>
            <option>سایز بزرگ است</option>
            <option>رنگ/مدل مطابق انتظار نبود</option>
            <option>ایراد دوخت/کیفیت</option>
          </select>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
          <button type="submit" className="cursor-pointer rounded-full bg-[var(--retail-gold)] px-6 py-3 text-sm font-extrabold text-white">
            ثبت درخواست
          </button>
        </form>
      )}

      {rows.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-bold">درخواست‌های شما</h2>
          <ul className="mt-4 space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-4 text-sm ring-1 ring-[var(--retail-border)]">
                <div className="flex justify-between gap-3">
                  <span>{r.requestType === 'EXCHANGE' ? 'تعویض' : 'مرجوعی'}</span>
                  <span className="font-bold">{r.status}</span>
                </div>
                <p className="mt-1 text-[var(--retail-muted)]">{r.reason}</p>
                {r.requestedSize ? <p className="mt-1">سایز جدید: {r.requestedSize}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

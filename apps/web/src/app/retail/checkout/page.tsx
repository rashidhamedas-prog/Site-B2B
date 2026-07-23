'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toman, useRetailCart } from '@/lib/retail-cart';
import { apiClient } from '@/lib/api';
import { getToken } from '@/lib/auth';

export default function RetailCheckoutPage() {
  const items = useRetailCart((s) => s.items);
  const clear = useRetailCart((s) => s.clear);
  const total = useMemo(() => items.reduce((n, i) => n + i.unitPrice * i.quantity, 0), [items]);
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'CASH'>('ONLINE');
  const [shippingMethod, setShippingMethod] = useState('PISHTAZ');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const submit = async () => {
    setError('');
    if (!items.length) {
      setError('سبد خالی است');
      return;
    }
    if (!getToken()) {
      setError('برای ثبت سفارش وارد حساب شوید.');
      window.location.href = '/retail/account?redirect=/retail/checkout';
      return;
    }
    setBusy(true);
    try {
      const order = await apiClient.post<{ orderNumber?: string; id?: string; paymentUrl?: string }>('/orders', {
        type: 'RETAIL_WEBSITE',
        channel: 'RETAIL',
        paymentMethod,
        shippingMethod,
        notes: notes || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          productVariantId: i.variantId,
          quantity: i.quantity,
          productName: i.productName,
          sku: i.sku,
          color: i.color,
          size: i.size,
        })),
      });
      clear();
      if ((order as any)?.paymentUrl) {
        window.location.href = (order as any).paymentUrl;
        return;
      }
      setDone(order.orderNumber ?? order.id ?? 'ثبت شد');
    } catch (e: any) {
      setError(e?.message || 'خطا در ثبت سفارش');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-extrabold text-[var(--retail-primary)]">سفارش ثبت شد</h1>
        <p className="mt-3 text-[var(--retail-muted)]">شماره سفارش: {done}</p>
        <Link href="/retail/account" className="mt-8 inline-block font-bold text-[var(--retail-primary)]">
          پیگیری سفارش
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
      <div className="rounded-2xl bg-white p-6 ring-1 ring-[var(--retail-border)]">
        <h1 className="text-xl font-extrabold">تسویه حساب</h1>
        <p className="mt-2 text-sm text-[var(--retail-muted)]">خرید تکی — بدون حداقل سفارش عمده</p>

        <div className="mt-8 space-y-4">
          <label className="block text-sm font-bold">روش ارسال</label>
          <select
            className="w-full rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
            value={shippingMethod}
            onChange={(e) => setShippingMethod(e.target.value)}
          >
            <option value="PISHTAZ">پست پیشتاز</option>
            <option value="TIPAX">تیپاکس</option>
            <option value="CHAPAR">چاپار</option>
            <option value="TEHRAN_BIKE">پیک تهران</option>
          </select>

          <label className="block text-sm font-bold">روش پرداخت</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ONLINE' as const, label: 'پرداخت آنلاین (زرین‌پال)' },
              { id: 'CASH' as const, label: 'پرداخت در محل' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id)}
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${
                  paymentMethod === m.id
                    ? 'border-[var(--retail-primary)] bg-[var(--retail-primary)] text-white'
                    : 'border-[var(--retail-border)]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <label className="block text-sm font-bold">توضیحات</label>
          <textarea
            className="min-h-24 w-full rounded-xl border border-[var(--retail-border)] px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="آدرس کامل را در حساب کاربری تکمیل کنید"
          />

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

          <button
            type="button"
            disabled={busy || !items.length}
            onClick={submit}
            className="w-full cursor-pointer rounded-full bg-[var(--retail-gold)] py-3.5 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {busy ? 'در حال ثبت…' : 'ثبت سفارش'}
          </button>

          {!getToken() ? (
            <p className="text-center text-sm text-[var(--retail-muted)]">
              حساب ندارید؟{' '}
              <Link href="/retail/account?redirect=/retail/checkout" className="font-bold text-[var(--retail-primary)]">
                ورود با پیامک
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      <aside className="h-fit rounded-2xl bg-white p-6 ring-1 ring-[var(--retail-border)]">
        <h2 className="font-bold">خلاصه سبد</h2>
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--retail-muted)]">سبد خالی است</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3 text-sm">
                <span className="truncate">
                  {i.productName} × {i.quantity.toLocaleString('fa-IR')}
                </span>
                <span className="shrink-0 font-bold">{toman(i.unitPrice * i.quantity)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex justify-between border-t border-[var(--retail-border)] pt-4">
          <span>جمع</span>
          <span className="text-lg font-extrabold">{toman(total)} تومان</span>
        </div>
      </aside>
    </div>
  );
}

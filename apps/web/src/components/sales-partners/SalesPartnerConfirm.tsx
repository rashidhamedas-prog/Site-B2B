'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';

type PublicDraft = {
  seller: string;
  partnerDisplayName: string;
  statusLabel: string;
  merchandiseIrr: number;
  shippingFeeIrr: number;
  items: { name: string | null; quantity: number; lineTotalIrr: number }[];
  cashEnabled: boolean;
  notice: string;
};

export function SalesPartnerConfirm({ token }: { token: string }) {
  const [data, setData] = useState<PublicDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'CASH'>('ONLINE');
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    apiClient
      .get<PublicDraft>(`/sales-partner-confirmations/${encodeURIComponent(token)}`)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'این لینک معتبر نیست'));
  }, [token]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/sales-partner-confirmations/${encodeURIComponent(token)}/confirm`, {
        recipientName,
        province,
        city,
        address,
        postalCode: postalCode || undefined,
        paymentMethod,
        consent,
      });
      setDone('سبد تأیید شد. اگر پرداخت آنلاین باشد، ادامه از درگاه ترنم انجام می‌شود.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تأیید ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await apiClient.post(`/sales-partner-confirmations/${encodeURIComponent(token)}/reject`, {});
      setDone('سبد رد شد. سفارشی ثبت نشد.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'رد سبد ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-8 text-right" dir="rtl">
      <h1 className="text-xl font-bold">تأیید سبد همکار</h1>
      {data && <p className="mt-2 text-sm text-stone-600">{data.notice}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {done && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{done}</p>}
      {data && !done && (
        <section className="mt-6 space-y-4">
          <p className="text-sm">فروشنده اصلی: {data.seller}</p>
          <p className="text-sm">همکار فروش: {data.partnerDisplayName}</p>
          <ul className="space-y-2">
            {data.items.map((item, i) => (
              <li key={`${item.name}-${i}`} className="rounded-xl border p-3 text-sm">
                {item.name} × {item.quantity} — {toman(item.lineTotalIrr)} تومان
              </li>
            ))}
          </ul>
          <p>مبلغ کالا: {toman(data.merchandiseIrr)} تومان</p>
          <p>هزینه ارسال برآوردی: {toman(data.shippingFeeIrr)} تومان</p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            <label className="block text-sm" htmlFor="cf-name">نام گیرنده</label>
            <input id="cf-name" className="min-h-11 w-full rounded-xl border px-3" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required />
            <label className="block text-sm" htmlFor="cf-province">استان</label>
            <input id="cf-province" className="min-h-11 w-full rounded-xl border px-3" value={province} onChange={(e) => setProvince(e.target.value)} required />
            <label className="block text-sm" htmlFor="cf-city">شهر</label>
            <input id="cf-city" className="min-h-11 w-full rounded-xl border px-3" value={city} onChange={(e) => setCity(e.target.value)} required />
            <label className="block text-sm" htmlFor="cf-address">نشانی</label>
            <textarea id="cf-address" className="min-h-24 w-full rounded-xl border px-3 py-2" value={address} onChange={(e) => setAddress(e.target.value)} required />
            <label className="block text-sm" htmlFor="cf-postal">کدپستی (اختیاری)</label>
            <input id="cf-postal" className="min-h-11 w-full rounded-xl border px-3" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            <fieldset>
              <legend className="text-sm">روش پرداخت</legend>
              <label className="mt-2 flex min-h-11 items-center gap-2">
                <input type="radio" name="pay" checked={paymentMethod === 'ONLINE'} onChange={() => setPaymentMethod('ONLINE')} />
                پرداخت آنلاین به ترنم
              </label>
              {data.cashEnabled && (
                <label className="flex min-h-11 items-center gap-2">
                  <input type="radio" name="pay" checked={paymentMethod === 'CASH'} onChange={() => setPaymentMethod('CASH')} />
                  پرداخت در محل
                </label>
              )}
            </fieldset>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              این سبد را تأیید می‌کنم و می‌دانم فروشنده اصلی ترنم است.
            </label>
            <button type="submit" className="min-h-11 w-full rounded-xl bg-[#1B5C4A] text-white" disabled={busy || !consent}>
              تأیید سبد
            </button>
            <button type="button" className="min-h-11 w-full rounded-xl border" disabled={busy} onClick={() => void reject()}>
              رد کردن سبد
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

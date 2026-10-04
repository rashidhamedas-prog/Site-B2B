'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/product-display';
import { SpButton, SpPageSkeleton, spFocusClass } from '@/components/sales-partners/SpUi';
import { cn } from '@/lib/cn';

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

const fieldClass = cn(
  'min-h-11 w-full rounded-2xl border border-stone-300 bg-white px-3 text-sm',
  spFocusClass,
);

export function SalesPartnerConfirm({ token }: { token: string }) {
  const [data, setData] = useState<PublicDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recipientName, setRecipientName] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    apiClient
      .get<PublicDraft>(`/sales-partner-confirmations/${encodeURIComponent(token)}`)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'این لینک معتبر نیست'))
      .finally(() => setLoading(false));
  }, [token]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const body = await apiClient.post<{
        orderId?: string;
        paymentUrl?: string | null;
        paymentStartError?: string | null;
      }>(`/sales-partner-confirmations/${encodeURIComponent(token)}/confirm`, {
        recipientName,
        province,
        city,
        address,
        postalCode: postalCode || undefined,
        paymentMethod: 'ONLINE',
        consent,
      });
      if (body.paymentStartError) {
        setError(body.paymentStartError);
        return;
      }
      if (body.paymentUrl) {
        window.location.assign(body.paymentUrl);
        return;
      }
      setDone('سبد تأیید شد. مبلغی برای درگاه نمانده و سفارش ثبت شد.');
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

  const total = (data?.merchandiseIrr || 0) + (data?.shippingFeeIrr || 0);

  return (
    <main className="min-h-screen bg-[#f6f3ee] text-stone-900" dir="rtl">
      <div className="mx-auto max-w-lg px-4 py-8 text-right">
        <p className="text-[11px] font-medium tracking-wide text-[#1B5C4A]">پوشاک ترنم</p>
        <h1 className="mt-1 text-2xl font-semibold">تأیید سبد خرید</h1>
        {loading && <SpPageSkeleton cards={2} />}
        {data && (
          <p className="mt-3 rounded-2xl border border-[#1B5C4A]/15 bg-white p-3 text-sm leading-7 text-stone-600">
            {data.notice}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-900" role="status">
            {done}
          </p>
        )}
        {data && !done && (
          <section className="mt-5 space-y-4">
            <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm shadow-stone-900/5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1B5C4A]/10 text-[#1B5C4A]">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 text-sm leading-6">
                  <p className="font-semibold text-stone-900">فروشنده: {data.seller}</p>
                  <p className="mt-1 text-stone-600">معرفی‌شده توسط {data.partnerDisplayName}</p>
                  <p className="mt-1 text-xs text-stone-500">وضعیت: {data.statusLabel}</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {data.items.map((item, i) => (
                  <li key={`${item.name}-${i}`} className="rounded-2xl bg-[#f6f3ee] px-3 py-2.5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span>
                        {item.name} × {item.quantity.toLocaleString('fa-IR')}
                      </span>
                      <span className="shrink-0 tabular-nums font-medium">{toman(item.lineTotalIrr)} تومان</span>
                    </div>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-2 border-t border-stone-100 pt-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-stone-600">مبلغ کالا</dt>
                  <dd className="tabular-nums">{toman(data.merchandiseIrr)} تومان</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-stone-600">ارسال برآوردی</dt>
                  <dd className="tabular-nums">{toman(data.shippingFeeIrr)} تومان</dd>
                </div>
                <div className="flex justify-between gap-2 text-base font-semibold">
                  <dt>جمع تقریبی</dt>
                  <dd className="tabular-nums text-[#1B5C4A]">{toman(total)} تومان</dd>
                </div>
              </dl>
            </div>

            <form
              className="space-y-3 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm"
              onSubmit={(e) => {
                e.preventDefault();
                void confirm();
              }}
            >
              <p className="text-sm font-medium text-stone-900">نشانی تحویل</p>
              <label className="block text-sm" htmlFor="cf-name">
                نام گیرنده
              </label>
              <input
                id="cf-name"
                className={fieldClass}
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm" htmlFor="cf-province">
                    استان
                  </label>
                  <input
                    id="cf-province"
                    className={fieldClass}
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm" htmlFor="cf-city">
                    شهر
                  </label>
                  <input
                    id="cf-city"
                    className={fieldClass}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </div>
              </div>
              <label className="block text-sm" htmlFor="cf-address">
                نشانی
              </label>
              <textarea
                id="cf-address"
                className="min-h-24 w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C]"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
              <label className="block text-sm" htmlFor="cf-postal">
                کدپستی (اختیاری)
              </label>
              <input
                id="cf-postal"
                className={fieldClass}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                dir="ltr"
              />
              <fieldset className="rounded-2xl bg-[#f6f3ee] p-3">
                <legend className="px-1 text-sm font-medium">روش پرداخت</legend>
                <p className="mt-2 text-sm">پرداخت آنلاین زرین‌پال</p>
              </fieldset>
              <label className="flex items-start gap-2 text-sm leading-6 text-stone-700">
                <input
                  type="checkbox"
                  className="mt-1 min-h-5 min-w-5"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                این سبد را تأیید می‌کنم و می‌دانم فروشنده اصلی ترنم است؛ پرداخت به همکار بازاریاب انجام نمی‌شود.
              </label>
              <SpButton type="submit" className="w-full" disabled={busy || !consent}>
                {busy ? 'در حال ثبت…' : 'تأیید سبد و ادامه'}
              </SpButton>
              <SpButton type="button" variant="destructive" className="w-full" disabled={busy} onClick={() => void reject()}>
                رد کردن سبد
              </SpButton>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}

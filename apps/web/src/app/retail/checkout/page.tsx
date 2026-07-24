'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toman, useRetailCart } from '@/lib/retail-cart';
import { apiClient } from '@/lib/api';
import { getToken } from '@/lib/auth';

const PROVINCES = [
  'تهران', 'خراسان رضوی', 'اصفهان', 'فارس', 'آذربایجان شرقی', 'آذربایجان غربی',
  'خوزستان', 'مازندران', 'گیلان', 'کرمان', 'البرز', 'قم', 'یزد', 'همدان',
  'کرمانشاه', 'گلستان', 'لرستان', 'مرکزی', 'قزوین', 'اردبیل', 'بوشهر',
  'زنجان', 'سمنان', 'سیستان و بلوچستان', 'کردستان', 'کهگیلویه و بویراحمد',
  'چهارمحال و بختیاری', 'ایلام', 'هرمزگان', 'خراسان شمالی', 'خراسان جنوبی',
];

const SHIP_METHODS = [
  { id: 'PISHTAZ', label: 'پست پیشتاز' },
  { id: 'TIPAX', label: 'تیپاکس' },
  { id: 'CHAPAR', label: 'چاپار' },
  { id: 'TEHRAN_BIKE', label: 'پیک تهران' },
];

type AddressForm = {
  province: string;
  city: string;
  postalCode: string;
  street: string;
  recipient: string;
  mobile: string;
};

function readAff(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const q = new URLSearchParams(window.location.search).get('aff');
    if (q) {
      sessionStorage.setItem('taranom_aff', q);
      return q;
    }
    return sessionStorage.getItem('taranom_aff') || undefined;
  } catch {
    return undefined;
  }
}

export default function RetailCheckoutPage() {
  const items = useRetailCart((s) => s.items);
  const clear = useRetailCart((s) => s.clear);
  const subtotal = useMemo(() => items.reduce((n, i) => n + i.unitPrice * i.quantity, 0), [items]);
  const pieces = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);

  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'CASH'>('ONLINE');
  const [shippingMethod, setShippingMethod] = useState('PISHTAZ');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [shipFee, setShipFee] = useState(0);
  const [shipMeta, setShipMeta] = useState<{ freeShipping?: boolean; estimatedDays?: string }>({});
  const [useWallet, setUseWallet] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [address, setAddress] = useState<AddressForm>({
    province: 'خراسان رضوی',
    city: 'مشهد',
    postalCode: '',
    street: '',
    recipient: '',
    mobile: '',
  });

  useEffect(() => {
    if (!getToken()) return;
    apiClient
      .get<{ balance?: number; phone?: string; ownerName?: string; businessName?: string }>(
        '/auth/me/profile',
      )
      .then((me) => {
        setWalletBalance(Number(me?.balance) || 0);
        setAddress((a) => ({
          ...a,
          recipient: a.recipient || me?.ownerName || me?.businessName || '',
          mobile: a.mobile || me?.phone || '',
        }));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!pieces) {
      setShipFee(0);
      return;
    }
    const params = new URLSearchParams({
      pieces: String(pieces),
      orderTotal: String(subtotal),
      method: shippingMethod,
      province: address.province,
    });
    apiClient
      .get<{ fee?: number; freeShipping?: boolean; estimatedDays?: string }>(`/shipping/quote?${params}`)
      .then((q) => {
        setShipFee(Number(q.fee) || 0);
        setShipMeta({ freeShipping: q.freeShipping, estimatedDays: q.estimatedDays });
      })
      .catch(() => {
        setShipFee(650_000);
        setShipMeta({});
      });
  }, [pieces, subtotal, shippingMethod, address.province]);

  const walletApplied = useWallet ? Math.min(walletBalance, Math.max(0, subtotal + shipFee)) : 0;
  const payable = Math.max(0, subtotal + shipFee - walletApplied);

  const submit = async () => {
    setError('');
    if (!items.length) {
      setError('سبد خالی است');
      return;
    }
    if (!getToken()) {
      setError('برای ثبت سفارش وارد حساب شوید.');
      window.location.href = '/account?redirect=/checkout';
      return;
    }
    if (!address.province || !address.city || !address.street || !address.recipient || !address.mobile) {
      setError('لطفاً آدرس کامل (استان، شهر، خیابان، گیرنده، موبایل) را پر کنید.');
      return;
    }
    setBusy(true);
    try {
      const order = await apiClient.post<{
        orderNumber?: string;
        id?: string;
        paymentUrl?: string;
      }>('/orders', {
        type: 'RETAIL_WEBSITE',
        channel: 'RETAIL',
        paymentMethod,
        shippingMethod,
        useWallet: useWallet && walletBalance > 0,
        affiliateId: readAff(),
        shippingAddress: address,
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
      if (order?.paymentUrl) {
        window.location.href = order.paymentUrl;
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
        <Link href="/account" className="mt-8 inline-block font-bold text-[var(--retail-primary)]">
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
          <h2 className="text-sm font-extrabold">آدرس تحویل</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-bold">استان</span>
              <select
                className="w-full rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
                value={address.province}
                onChange={(e) => setAddress((a) => ({ ...a, province: e.target.value }))}
              >
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-bold">شهر</span>
              <input
                className="w-full rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
                value={address.city}
                onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-bold">کدپستی</span>
              <input
                className="w-full rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
                value={address.postalCode}
                onChange={(e) => setAddress((a) => ({ ...a, postalCode: e.target.value }))}
                inputMode="numeric"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-bold">موبایل گیرنده</span>
              <input
                className="w-full rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
                value={address.mobile}
                onChange={(e) => setAddress((a) => ({ ...a, mobile: e.target.value }))}
                inputMode="tel"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-bold">نام گیرنده</span>
              <input
                className="w-full rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
                value={address.recipient}
                onChange={(e) => setAddress((a) => ({ ...a, recipient: e.target.value }))}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-bold">خیابان / پلاک / واحد</span>
              <textarea
                className="min-h-20 w-full rounded-xl border border-[var(--retail-border)] px-3 py-2 text-sm"
                value={address.street}
                onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))}
              />
            </label>
          </div>

          <label className="block text-sm font-bold">روش ارسال</label>
          <select
            className="w-full rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
            value={shippingMethod}
            onChange={(e) => setShippingMethod(e.target.value)}
          >
            {SHIP_METHODS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          {shipMeta.estimatedDays ? (
            <p className="text-xs text-[var(--retail-muted)]">زمان تقریبی: {shipMeta.estimatedDays}</p>
          ) : null}

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

          {walletBalance > 0 ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useWallet}
                onChange={(e) => setUseWallet(e.target.checked)}
              />
              <span>
                استفاده از اعتبار کیف‌پول ({toman(walletBalance)} تومان)
              </span>
            </label>
          ) : null}

          <label className="block text-sm font-bold">توضیحات (اختیاری)</label>
          <textarea
            className="min-h-16 w-full rounded-xl border border-[var(--retail-border)] px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="توضیح برای پیک یا پشتیبانی"
          />

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

          <button
            type="button"
            disabled={busy || !items.length}
            onClick={submit}
            className="w-full cursor-pointer rounded-full bg-[var(--retail-gold)] py-3.5 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {busy
              ? 'در حال ثبت…'
              : paymentMethod === 'ONLINE' && payable > 0
                ? `پرداخت ${toman(payable)} تومان`
                : 'ثبت سفارش'}
          </button>

          {!getToken() ? (
            <p className="text-center text-sm text-[var(--retail-muted)]">
              حساب ندارید؟{' '}
              <Link href="/account?redirect=/checkout" className="font-bold text-[var(--retail-primary)]">
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
              <li key={`${i.productId}-${i.variantId}`} className="flex justify-between gap-3 text-sm">
                <span className="truncate">
                  {i.productName} × {i.quantity.toLocaleString('fa-IR')}
                </span>
                <span className="shrink-0 font-bold">{toman(i.unitPrice * i.quantity)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 space-y-2 border-t border-[var(--retail-border)] pt-4 text-sm">
          <div className="flex justify-between">
            <span>جمع کالا</span>
            <span>{toman(subtotal)} تومان</span>
          </div>
          <div className="flex justify-between">
            <span>ارسال</span>
            <span>{shipMeta.freeShipping ? 'رایگان' : `${toman(shipFee)} تومان`}</span>
          </div>
          {walletApplied > 0 ? (
            <div className="flex justify-between text-emerald-700">
              <span>کیف‌پول</span>
              <span>−{toman(walletApplied)}</span>
            </div>
          ) : null}
          <div className="flex justify-between pt-2 text-base">
            <span>قابل پرداخت</span>
            <span className="text-lg font-extrabold">{toman(payable)} تومان</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

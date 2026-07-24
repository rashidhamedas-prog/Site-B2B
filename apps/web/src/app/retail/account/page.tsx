'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiClient } from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/auth';
import { getWishlist, type WishlistItem } from '@/lib/retail-wishlist';
import { getRetailAddresses, type RetailAddress } from '@/lib/retail-addresses';
import { InvoicesPage } from '@/components/portal/InvoicesPage';

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  trackingCode?: string | null;
};

const STATUS_STEPS = ['PENDING_REVIEW', 'CONFIRMED', 'PACKING', 'SHIPPED', 'DELIVERED'] as const;
const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: 'در بررسی',
  CONFIRMED: 'تأیید شد',
  PACKING: 'آماده‌سازی',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل',
  CANCELLED: 'لغو',
};

function mediaUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

function OrderTimeline({ status }: { status: string }) {
  const idx = STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]);
  return (
    <ol className="mt-3 flex flex-wrap gap-2">
      {STATUS_STEPS.map((s, i) => {
        const done = idx >= 0 && i <= idx;
        return (
          <li
            key={s}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              done ? 'bg-[var(--retail-primary)] text-white' : 'bg-gray-100 text-gray-400'
            }`}
          >
            {STATUS_LABEL[s]}
          </li>
        );
      })}
    </ol>
  );
}

function RetailAccountInner() {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = search.get('redirect') || '/checkout';
  const tab = search.get('tab') || 'home';

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [profileName, setProfileName] = useState('');
  const [addresses, setAddresses] = useState<RetailAddress[]>([]);

  useEffect(() => {
    setLoggedIn(!!getToken());
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    setWishlist(getWishlist());
    setAddresses(getRetailAddresses());
    (async () => {
      try {
        const [res, profile] = await Promise.all([
          apiClient.get<{ data: OrderRow[] }>('/orders?limit=20'),
          apiClient.get<{ balance?: number; ownerName?: string; businessName?: string; phone?: string }>(
            '/auth/me/profile',
          ),
        ]);
        setOrders(Array.isArray(res.data) ? res.data : []);
        setWalletBalance(Number(profile?.balance) || 0);
        setProfileName(profile?.ownerName || profile?.businessName || profile?.phone || '');
      } catch {
        setOrders([]);
      }
    })();
  }, [loggedIn]);

  const requestOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiClient.post<{ message: string; phone: string; devCode?: string }>(
        '/auth/retail/otp/request',
        { phone, name },
      );
      if (res.devCode) setDevCode(res.devCode);
      setPhone(res.phone || phone);
      setStep('code');
    } catch (err: any) {
      setError(err?.message || 'خطا در ارسال کد');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiClient.post<{ accessToken: string; role: string }>(
        '/auth/retail/otp/verify',
        { phone, code, name },
      );
      setToken(res.accessToken, res.role);
      setLoggedIn(true);
      if (redirect && redirect !== '/account') router.push(redirect);
    } catch (err: any) {
      setError(err?.message || 'کد نامعتبر است');
    } finally {
      setBusy(false);
    }
  };

  if (!loggedIn) {
    return (
      <div className="mx-auto max-w-md px-4 py-14">
        <h1 className="text-2xl font-extrabold">ورود با پیامک</h1>
        <p className="mt-2 text-sm text-[var(--retail-muted)]">شماره موبایل‌تان را وارد کنید تا کد تأیید بفرستیم.</p>
        {step === 'phone' ? (
          <form onSubmit={requestOtp} className="mt-8 space-y-4">
            <input
              className="w-full rounded-xl border px-4 py-3 text-sm"
              placeholder="نام (اختیاری)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full rounded-xl border px-4 py-3 text-sm"
              placeholder="09xxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-[var(--retail-gold)] py-3 text-sm font-extrabold text-white"
            >
              {busy ? '…' : 'دریافت کد'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="mt-8 space-y-4">
            <p className="text-sm text-[var(--retail-muted)]">کد به {phone} ارسال شد</p>
            {devCode ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs">کد آزمایشی: {devCode}</p> : null}
            <input
              className="w-full rounded-xl border px-4 py-3 text-center text-lg tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              dir="ltr"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-[var(--retail-primary)] py-3 text-sm font-extrabold text-white"
            >
              {busy ? '…' : 'تأیید و ورود'}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">حساب من</h1>
          {profileName ? <p className="mt-1 text-sm text-[var(--retail-muted)]">{profileName}</p> : null}
        </div>
        <button
          type="button"
          className="text-sm text-red-600"
          onClick={() => {
            clearToken();
            setLoggedIn(false);
          }}
        >
          خروج
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-[var(--retail-primary)] px-5 py-4 text-white">
        <p className="text-xs font-bold opacity-80">اعتبار کیف‌پول</p>
        <p className="mt-1 text-2xl font-extrabold">
          {Math.round(walletBalance / 10).toLocaleString('fa-IR')} تومان
        </p>
        <p className="mt-1 text-xs opacity-70">در چک‌اوت می‌توانید از اعتبار استفاده کنید</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { id: 'home', label: 'سفارش‌ها' },
          { id: 'addresses', label: 'آدرس‌ها' },
          { id: 'wishlist', label: 'علاقه‌مندی' },
          { id: 'invoices', label: 'فاکتورها' },
          { id: 'returns', label: 'مرجوعی' },
        ].map((t) => (
          <Link
            key={t.id}
            href={t.id === 'returns' ? '/returns' : `/account?tab=${t.id}`}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              tab === t.id ? 'bg-[var(--retail-primary)] text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'invoices' ? (
        <div className="mt-8">
          <InvoicesPage />
        </div>
      ) : null}

      {tab === 'addresses' ? (
        <div className="mt-8 space-y-3">
          {addresses.length === 0 ? (
            <p className="text-sm text-[var(--retail-muted)]">
              هنوز آدرسی ذخیره نشده. بعد از اولین چک‌اوت اینجا نمایش داده می‌شود.
            </p>
          ) : (
            addresses.map((a, i) => (
              <div key={i} className="rounded-2xl border border-[var(--retail-border)] bg-white p-4 text-sm">
                <p className="font-bold">{a.recipient} — {a.mobile}</p>
                <p className="mt-1 text-[var(--retail-muted)]">
                  {a.province}، {a.city}
                  {a.postalCode ? `، کدپستی ${a.postalCode}` : ''}
                </p>
                <p className="mt-1">{a.street}</p>
                <Link href="/checkout" className="mt-3 inline-block text-xs font-bold text-[var(--retail-primary)]">
                  استفاده در چک‌اوت
                </Link>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === 'wishlist' ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {wishlist.length === 0 ? (
            <p className="text-sm text-[var(--retail-muted)]">لیست علاقه‌مندی خالی است.</p>
          ) : (
            wishlist.map((w) => {
              const img = mediaUrl(w.imageUrl);
              return (
                <Link
                  key={w.productId}
                  href={`/products/${w.slug}`}
                  className="flex gap-3 rounded-2xl border border-[var(--retail-border)] p-3"
                >
                  <div className="relative h-20 w-16 overflow-hidden rounded-lg bg-[var(--retail-bg)]">
                    {img ? <Image src={img} alt={w.name} fill className="object-cover" sizes="64px" /> : null}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{w.name}</p>
                    {w.price ? (
                      <p className="mt-1 text-xs text-[var(--retail-primary)]">
                        {Math.round(w.price / 10).toLocaleString('fa-IR')} ت
                      </p>
                    ) : null}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      ) : null}

      {tab === 'home' ? (
        <div className="mt-8 space-y-4">
          <div className="flex flex-wrap gap-3">
            <Link href="/checkout" className="rounded-full bg-[var(--retail-gold)] px-5 py-2.5 text-sm font-extrabold text-white">
              تسویه حساب
            </Link>
            <Link href="/products" className="rounded-full border px-5 py-2.5 text-sm font-bold">
              ادامه خرید
            </Link>
          </div>
          <h2 className="pt-4 text-lg font-bold">پیگیری سفارش</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-[var(--retail-muted)]">هنوز سفارشی ثبت نکرده‌اید.</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="rounded-2xl border border-[var(--retail-border)] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-sm font-bold">{o.orderNumber}</p>
                  <p className="text-xs text-[var(--retail-muted)]">
                    {new Date(o.createdAt).toLocaleDateString('fa-IR')}
                  </p>
                </div>
                <p className="mt-1 text-sm">
                  {Math.round(Number(o.total) / 10).toLocaleString('fa-IR')} تومان —{' '}
                  {STATUS_LABEL[o.status] || o.status}
                </p>
                {o.trackingCode ? (
                  <p className="mt-1 text-xs text-[var(--retail-muted)]">
                    کد پیگیری:{' '}
                    <button
                      type="button"
                      className="font-bold text-[var(--retail-primary)]"
                      onClick={() => {
                        apiClient
                          .get<{ url?: string }>(`/shipping/track/${encodeURIComponent(o.trackingCode!)}`)
                          .then((t) => {
                            if (t?.url) window.open(t.url, '_blank');
                          })
                          .catch(() => undefined);
                      }}
                    >
                      {o.trackingCode}
                    </button>
                  </p>
                ) : null}
                <OrderTimeline status={o.status} />
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function RetailAccountPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-[var(--retail-muted)]">در حال بارگذاری…</div>}>
      <RetailAccountInner />
    </Suspense>
  );
}

'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/auth';

export function RetailOtpLogin() {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = search.get('redirect') || '/retail/checkout';

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getToken());
  }, []);

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
      router.push(redirect);
    } catch (err: any) {
      setError(err?.message || 'کد نامعتبر است');
    } finally {
      setBusy(false);
    }
  };

  if (loggedIn) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-[var(--retail-ink)]">وارد شده‌اید</h1>
        <p className="mt-3 text-sm text-[var(--retail-muted)]">می‌توانید سفارش تکی ثبت کنید یا از حساب خارج شوید.</p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/retail/checkout"
            className="rounded-full bg-[var(--retail-gold)] py-3 text-sm font-extrabold text-white"
          >
            رفتن به تسویه حساب
          </Link>
          <Link href="/retail/products" className="text-sm font-bold text-[var(--retail-primary)]">
            ادامه خرید
          </Link>
          <button
            type="button"
            className="cursor-pointer text-sm text-red-600"
            onClick={() => {
              clearToken();
              setLoggedIn(false);
              setStep('phone');
            }}
          >
            خروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-extrabold text-[var(--retail-ink)]">ورود به فروشگاه</h1>
      <p className="mt-2 text-sm text-[var(--retail-muted)]">ورود با پیامک — بدون نیاز به تأیید عمده</p>

      {step === 'phone' ? (
        <form onSubmit={requestOtp} className="mt-8 space-y-4">
          <label className="block text-sm font-bold">نام (اختیاری)</label>
          <input
            className="w-full rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثلاً سارا محمدی"
          />
          <label className="block text-sm font-bold">شماره موبایل</label>
          <input
            className="w-full rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0912xxxxxxx"
            inputMode="tel"
            required
          />
          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full cursor-pointer rounded-full bg-[var(--retail-primary)] py-3 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {busy ? 'در حال ارسال…' : 'دریافت کد'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="mt-8 space-y-4">
          <p className="text-sm text-[var(--retail-muted)]">کد به {phone} ارسال شد</p>
          {devCode ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              حالت توسعه — کد: <strong>{devCode}</strong>
            </p>
          ) : null}
          <label className="block text-sm font-bold">کد تأیید</label>
          <input
            className="w-full rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-center text-lg tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="------"
            inputMode="numeric"
            required
          />
          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full cursor-pointer rounded-full bg-[var(--retail-gold)] py-3 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {busy ? 'در حال بررسی…' : 'ورود'}
          </button>
          <button
            type="button"
            className="w-full cursor-pointer text-sm text-[var(--retail-muted)]"
            onClick={() => {
              setStep('phone');
              setCode('');
              setDevCode('');
              setError('');
            }}
          >
            تغییر شماره
          </button>
        </form>
      )}
    </div>
  );
}

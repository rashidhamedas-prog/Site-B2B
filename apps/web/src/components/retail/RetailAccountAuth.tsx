'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { PasswordField } from '@/components/account/PasswordField';
import { safeAccountRedirect } from '@/lib/safe-redirect';

export function RetailAccountAuth({ redirect }: { redirect: string }) {
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = (token: string, role: string) => {
    setToken(token, role, 'retail');
    window.location.href = safeAccountRedirect(redirect);
  };

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطا در ارسال کد');
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
      finish(res.accessToken, res.role);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'کد نامعتبر است');
    } finally {
      setBusy(false);
    }
  };

  const loginPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiClient.post<{ accessToken: string; role: string }>('/auth/login', {
        phone,
        password,
        purpose: 'retail',
      });
      finish(res.accessToken, res.role);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ورود ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-2xl font-extrabold">ورود به حساب</h1>
      <p className="mt-2 text-sm text-[var(--retail-muted)]">
        با پیامک وارد شوید یا اگر رمز تعیین کرده‌اید، از رمز استفاده کنید.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
        <button
          type="button"
          className={`rounded-xl py-2 text-sm font-bold ${mode === 'otp' ? 'bg-white text-[var(--retail-primary)] shadow-sm' : 'text-gray-500'}`}
          onClick={() => setMode('otp')}
        >
          ورود با پیامک
        </button>
        <button
          type="button"
          className={`rounded-xl py-2 text-sm font-bold ${mode === 'password' ? 'bg-white text-[var(--retail-primary)] shadow-sm' : 'text-gray-500'}`}
          onClick={() => setMode('password')}
        >
          ورود با رمز
        </button>
      </div>

      {mode === 'otp' && step === 'phone' ? (
        <form onSubmit={requestOtp} className="mt-8 space-y-4">
          <input
            className="w-full rounded-xl border px-4 py-3 text-sm"
            placeholder="نام (اختیاری)"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full rounded-xl border px-4 py-3 text-sm"
            placeholder="09xxxxxxxxx"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            dir="ltr"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-[var(--retail-gold)] py-3 text-sm font-extrabold text-white disabled:opacity-60"
          >
            {busy ? '…' : 'دریافت کد'}
          </button>
        </form>
      ) : null}

      {mode === 'otp' && step === 'code' ? (
        <form onSubmit={verifyOtp} className="mt-8 space-y-4">
          <p className="text-sm text-[var(--retail-muted)]">کد به {phone} ارسال شد</p>
          {devCode ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs">کد آزمایشی: {devCode}</p> : null}
          <input
            className="w-full rounded-xl border px-4 py-3 text-center text-lg tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            inputMode="numeric"
            required
            dir="ltr"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-[var(--retail-primary)] py-3 text-sm font-extrabold text-white disabled:opacity-60"
          >
            {busy ? '…' : 'تأیید و ورود'}
          </button>
          <button type="button" className="w-full text-sm text-gray-500 underline" onClick={() => setStep('phone')}>
            تغییر شماره
          </button>
        </form>
      ) : null}

      {mode === 'password' ? (
        <form onSubmit={loginPassword} className="mt-8 space-y-4">
          <input
            className="w-full rounded-xl border px-4 py-3 text-sm"
            placeholder="09xxxxxxxxx"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            dir="ltr"
          />
          <PasswordField
            label="رمز عبور"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-[var(--retail-primary)] py-3 text-sm font-extrabold text-white disabled:opacity-60"
          >
            {busy ? '…' : 'ورود'}
          </button>
          <p className="text-center text-sm">
            <Link href="/account/forgot-password" className="font-bold text-[var(--retail-primary)]">
              فراموشی رمز
            </Link>
          </p>
        </form>
      ) : null}
    </div>
  );
}

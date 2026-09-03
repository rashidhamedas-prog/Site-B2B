'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { validateNewPassword } from '@/lib/password-policy';
import { PasswordField } from './PasswordField';

type ResetResult = {
  message: string;
  canLogin?: boolean;
  accessToken?: string;
  role?: string;
};

export function ForgotPasswordFlow({
  loginHref,
  successHref,
  variant,
}: {
  loginHref: string;
  successHref: string;
  variant: 'retail' | 'wholesale';
}) {
  const [step, setStep] = useState<'phone' | 'reset'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const retail = variant === 'retail';
  const fieldClass = retail
    ? 'w-full rounded-xl border px-4 py-3 text-sm'
    : 'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm';

  const requestCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiClient.post<{ message: string; phone: string; devCode?: string }>(
        '/auth/password/forgot',
        { phone },
      );
      setPhone(res.phone || phone);
      setInfo(res.message);
      if (res.devCode) setDevCode(res.devCode);
      setStep('reset');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ارسال کد ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const policy = validateNewPassword(password, phone);
    if (policy) {
      setError(policy);
      return;
    }
    if (password !== confirm) {
      setError('تکرار رمز با رمز جدید یکی نیست');
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.post<ResetResult>('/auth/password/reset', {
        phone,
        code,
        password,
      });
      if (res.accessToken && res.canLogin) {
        setToken(res.accessToken, res.role || 'CUSTOMER', 'storefront');
        window.location.href = successHref;
        return;
      }
      setInfo(res.message || 'رمز ذخیره شد. حالا وارد شوید.');
      window.location.href = loginHref;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'بازیابی رمز ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {info ? (
        <p className={`rounded-xl px-3 py-2 text-sm ${retail ? 'bg-amber-50 text-amber-900' : 'bg-primary-50 text-primary'}`}>
          {info}
        </p>
      ) : null}
      {step === 'phone' ? (
        <form onSubmit={requestCode} className="space-y-4" noValidate>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="forgot-phone">
              شماره موبایل
            </label>
            <input
              id="forgot-phone"
              className={fieldClass}
              inputMode="numeric"
              autoComplete="tel"
              placeholder="09xxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className={
              retail
                ? 'w-full rounded-full bg-[var(--retail-gold)] py-3 text-sm font-extrabold text-white disabled:opacity-60'
                : 'btn btn-primary btn-md w-full'
            }
          >
            {busy ? 'در حال ارسال…' : 'ارسال کد پیامکی'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitReset} className="space-y-4" noValidate>
          <p className="text-sm text-gray-500">کد ارسال‌شده به {phone} را وارد کنید و رمز تازه بگذارید.</p>
          {devCode ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs">کد آزمایشی: {devCode}</p> : null}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="forgot-code">
              کد تأیید
            </label>
            <input
              id="forgot-code"
              className={`${fieldClass} text-center tracking-[0.4em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              dir="ltr"
            />
          </div>
          <PasswordField
            label="رمز عبور جدید"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
            hint="حداقل ۸ کاراکتر، بدون فاصله"
          />
          <PasswordField
            label="تکرار رمز جدید"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            required
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className={
              retail
                ? 'w-full rounded-full bg-[var(--retail-primary)] py-3 text-sm font-extrabold text-white disabled:opacity-60'
                : 'btn btn-primary btn-md w-full'
            }
          >
            {busy ? 'در حال ذخیره…' : 'ذخیره رمز و ادامه'}
          </button>
          <button
            type="button"
            className="w-full text-sm text-gray-500 underline"
            onClick={() => {
              setStep('phone');
              setCode('');
              setDevCode('');
              setError('');
            }}
          >
            تغییر شماره یا ارسال دوباره
          </button>
        </form>
      )}
      <p className="text-center text-sm text-gray-500">
        رمز را به یاد آوردید؟{' '}
        <Link href={loginHref} className={retail ? 'font-bold text-[var(--retail-primary)]' : 'text-primary hover:underline'}>
          بازگشت به ورود
        </Link>
      </p>
    </div>
  );
}

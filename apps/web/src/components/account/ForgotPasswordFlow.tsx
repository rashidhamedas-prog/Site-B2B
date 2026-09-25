'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MessageSquare, Phone } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { BlurFade } from '@/components/auth/BlurFade';
import { GlassInput } from '@/components/auth/GlassInput';
import { GlassButton } from '@/components/ui/glass-button';
import { apiClient } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { cookieScopeFromPurpose } from '@/lib/admin-session';
import { validateNewPassword } from '@/lib/password-policy';

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
  embedded = false,
}: {
  loginHref: string;
  successHref: string;
  variant: 'retail' | 'wholesale';
  /** When true, skip AuthShell (caller already wraps) */
  embedded?: boolean;
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
        purpose: variant,
      });
      if (res.accessToken && res.canLogin) {
        setToken(res.accessToken, res.role || 'CUSTOMER', cookieScopeFromPurpose(variant));
        window.location.href = successHref;
        return;
      }
      setInfo(res.message || 'رمز ذخیره شد. حالا وارد شوید.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'بازیابی رمز ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <div className="w-full max-w-[320px] space-y-5">
      {!embedded ? null : (
        <div className="text-center">
          <p className="text-2xl font-extrabold text-[var(--brand-ink)]">بازیابی رمز</p>
          <p className="mt-1 text-sm text-[var(--brand-muted)]">کد پیامکی برای رمز تازه</p>
        </div>
      )}

      {info ? (
        <p
          role="status"
          className="rounded-xl bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] px-3 py-2 text-sm text-[var(--color-primary-dark)]"
        >
          {info}
        </p>
      ) : null}

      {step === 'phone' ? (
        <form onSubmit={requestCode} className="space-y-4" noValidate>
          <GlassInput icon={<Phone className="h-5 w-5" aria-hidden />}>
            <input
              id="forgot-phone"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="09xxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
              aria-label="شماره موبایل"
              className="text-left"
            />
          </GlassInput>
          {error ? (
            <p role="alert" className="text-center text-sm text-[var(--brand-error)]">
              {error}
            </p>
          ) : null}
          <GlassButton type="submit" size="full" disabled={busy}>
            {busy ? 'در حال ارسال…' : 'ارسال کد پیامکی'}
          </GlassButton>
        </form>
      ) : (
        <form onSubmit={submitReset} className="space-y-4" noValidate>
          <p className="text-center text-sm text-[var(--brand-muted)]">
            کد ارسال‌شده به {phone} را وارد کنید و رمز تازه بگذارید.
          </p>
          {devCode ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
              کد آزمایشی: {devCode}
            </p>
          ) : null}
          <GlassInput icon={<MessageSquare className="h-5 w-5" aria-hidden />}>
            <input
              id="forgot-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              dir="ltr"
              aria-label="کد تأیید"
              className="text-center tracking-[0.35em]"
            />
          </GlassInput>
          <GlassInput>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              placeholder="رمز عبور جدید (حداقل ۸)"
              aria-label="رمز عبور جدید"
            />
          </GlassInput>
          <GlassInput>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              placeholder="تکرار رمز جدید"
              aria-label="تکرار رمز جدید"
            />
          </GlassInput>
          {error ? (
            <p role="alert" className="text-center text-sm text-[var(--brand-error)]">
              {error}
            </p>
          ) : null}
          <GlassButton type="submit" size="full" disabled={busy}>
            {busy ? 'در حال ذخیره…' : 'ذخیره رمز و ادامه'}
          </GlassButton>
          <button
            type="button"
            className="mx-auto flex items-center gap-1.5 text-sm text-[var(--brand-muted)] hover:text-[var(--brand-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
            onClick={() => {
              setStep('phone');
              setCode('');
              setDevCode('');
              setError('');
            }}
          >
            <ArrowRight className="h-4 w-4" />
            تغییر شماره یا ارسال دوباره
          </button>
        </form>
      )}

      <p className="text-center text-sm text-[var(--brand-muted)]">
        رمز را به یاد آوردید؟{' '}
        <Link
          href={loginHref}
          className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
        >
          بازگشت به ورود
        </Link>
      </p>
    </div>
  );

  if (embedded) return body;

  return (
    <AuthShell
      brandName={variant === 'retail' ? 'حساب من — ترنم' : 'پنل عمده ترنم'}
      compact={variant === 'retail'}
    >
      <div className="w-full text-center">
        <BlurFade>
          <p className="text-3xl font-extrabold tracking-tight text-[var(--brand-ink)]">بازیابی رمز</p>
        </BlurFade>
        <BlurFade delay={0.1}>
          <p className="mt-2 text-sm text-[var(--brand-muted)]">کد پیامکی می‌فرستیم تا رمز تازه بگذارید</p>
        </BlurFade>
      </div>
      {body}
    </AuthShell>
  );
}

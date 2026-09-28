'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MessageSquare, Phone } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { BlurFade } from '@/components/auth/BlurFade';
import { GlassInput } from '@/components/auth/GlassInput';
import { SmsResendButton } from '@/components/auth/SmsResendButton';
import { GlassButton } from '@/components/ui/glass-button';
import { useSmsResendCooldown } from '@/hooks/useSmsResendCooldown';
import { apiClient } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { safeScopedRedirect } from '@/lib/safe-redirect';
import { extractSmsCooldown } from '@/lib/sms-cooldown';
import { cn } from '@/lib/cn';

export function SalesPartnerLoginForm() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { secondsLeft, start, reset: resetCooldown } = useSmsResendCooldown();

  function goHome(token: string, role: string) {
    setToken(token, role, 'sales_partner');
    const params = new URLSearchParams(window.location.search);
    window.location.href = safeScopedRedirect(params.get('redirect'), '/sales-partners', ['/sales-partners']);
  }

  async function requestOtp(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    const wasSent = otpSent;
    try {
      const res = await apiClient.post<{ cooldownSeconds?: number; remainingSeconds?: number }>(
        '/sales-partners/auth/otp/request',
        { phone: normalizePhone(phone) },
      );
      setOtpSent(true);
      setStatus('کد تأیید ارسال شد.');
      start(extractSmsCooldown(null, res));
    } catch (err) {
      const statusCode =
        err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : 0;
      if (statusCode === 429) {
        start(extractSmsCooldown(err));
        if (wasSent) setOtpSent(true);
      }
      setError(err instanceof Error ? err.message : 'ارسال کد ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post<{ accessToken: string; role: string }>('/sales-partners/auth/otp/verify', {
        phone: normalizePhone(phone),
        code: code.trim(),
      });
      goHome(res.accessToken, res.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ورود ناموفق بود');
      setBusy(false);
    }
  }

  async function loginPassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post<{ accessToken: string; role: string }>('/sales-partners/auth/login', {
        phone: normalizePhone(phone),
        password,
      });
      goHome(res.accessToken, res.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ورود ناموفق بود');
      setBusy(false);
    }
  }

  function changePhone() {
    setOtpSent(false);
    setCode('');
    setError(null);
    setStatus(null);
    resetCooldown();
  }

  return (
    <AuthShell
      brandName="همکار بازاریاب ترنم"
      footer={
        <p className="text-center text-sm">
          <Link
            className="font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
            href="/sales-partnership"
          >
            درخواست همکاری
          </Link>
        </p>
      }
    >
      <div className="w-full max-w-[320px] text-center">
        <BlurFade>
          <p className="text-3xl font-extrabold tracking-tight text-[var(--brand-ink)]">ورود</p>
        </BlurFade>
        <BlurFade delay={0.1}>
          <p className="mt-2 text-sm leading-7 text-[var(--brand-muted)]">
            این ورود برای همکار بازاریاب است، نه تأمین‌کننده ارسال.
          </p>
        </BlurFade>
      </div>

      <div
        className="grid w-full max-w-[320px] grid-cols-2 gap-1 rounded-full bg-white/50 p-1 backdrop-blur-sm"
        role="group"
        aria-label="روش ورود"
      >
        <button
          type="button"
          className={cn(
            'rounded-full py-2 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]',
            mode === 'otp' ? 'bg-white text-[var(--color-primary)] shadow-sm' : 'text-[var(--brand-muted)]',
          )}
          onClick={() => setMode('otp')}
          aria-pressed={mode === 'otp'}
        >
          پیامک
        </button>
        <button
          type="button"
          className={cn(
            'rounded-full py-2 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]',
            mode === 'password' ? 'bg-white text-[var(--color-primary)] shadow-sm' : 'text-[var(--brand-muted)]',
          )}
          onClick={() => setMode('password')}
          aria-pressed={mode === 'password'}
        >
          رمز
        </button>
      </div>

      {error ? (
        <p role="alert" className="w-full max-w-[320px] rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-[var(--brand-error)]">
          {error}
        </p>
      ) : null}

      {mode === 'otp' && !otpSent ? (
        <form className="w-full max-w-[320px] space-y-4" onSubmit={requestOtp}>
          <GlassInput icon={<Phone className="h-5 w-5" aria-hidden />}>
            <input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
              placeholder="09xxxxxxxxx"
              aria-label="شماره موبایل"
              className="text-left"
            />
          </GlassInput>
          <GlassButton type="submit" size="full" disabled={busy}>
            {busy ? 'در حال ارسال…' : 'دریافت کد'}
          </GlassButton>
        </form>
      ) : null}

      {mode === 'otp' && otpSent ? (
        <form className="w-full max-w-[320px] space-y-4" onSubmit={verifyOtp}>
          {status ? (
            <p className="text-center text-sm text-[var(--brand-muted)]" role="status">
              {status}
            </p>
          ) : null}
          <GlassInput icon={<MessageSquare className="h-5 w-5" aria-hidden />}>
            <input
              id="code"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              dir="ltr"
              aria-label="کد تأیید"
              className="text-center tracking-widest"
            />
          </GlassInput>
          <GlassButton type="submit" size="full" disabled={busy}>
            {busy ? 'در حال ورود…' : 'ورود'}
          </GlassButton>
          <SmsResendButton secondsLeft={secondsLeft} onResend={() => void requestOtp()} busy={busy} />
          <button
            type="button"
            className="mx-auto flex items-center gap-1.5 text-sm text-[var(--brand-muted)] hover:text-[var(--brand-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
            onClick={changePhone}
          >
            <ArrowRight className="h-4 w-4" />
            تغییر شماره
          </button>
        </form>
      ) : null}

      {mode === 'password' ? (
        <form className="w-full max-w-[320px] space-y-4" onSubmit={loginPassword}>
          <GlassInput icon={<Phone className="h-5 w-5" aria-hidden />}>
            <input
              id="phone2"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
              placeholder="09xxxxxxxxx"
              aria-label="شماره موبایل"
              className="text-left"
            />
          </GlassInput>
          <GlassInput>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="رمز عبور"
              aria-label="رمز عبور"
            />
          </GlassInput>
          <GlassButton type="submit" size="full" disabled={busy}>
            {busy ? 'در حال ورود…' : 'ورود'}
          </GlassButton>
        </form>
      ) : null}
    </AuthShell>
  );
}

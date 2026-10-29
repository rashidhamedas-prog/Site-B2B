'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, MessageSquare, Phone } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { BlurFade } from '@/components/auth/BlurFade';
import { GlassInput } from '@/components/auth/GlassInput';
import { OtpDeliveryNote } from '@/components/auth/OtpDeliveryNote';
import { SmsResendButton } from '@/components/auth/SmsResendButton';
import { GlassButton } from '@/components/ui/glass-button';
import { useSmsResendCooldown } from '@/hooks/useSmsResendCooldown';
import { apiClient } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { extractSmsCooldown, readSmsCooldownSeconds } from '@/lib/sms-cooldown';
import { safeAccountRedirect } from '@/lib/safe-redirect';
import { cn } from '@/lib/cn';
import { IRAN_PROVINCES } from '@/lib/iran-geo';

function retailIdentityError(name: string, province: string, city: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (trimmed.length < 2 || trimmed === 'خریدار ترنم' || trimmed === 'نامشخص') {
    return 'نام و نام خانوادگی را کامل وارد کنید';
  }
  if (!province.trim()) return 'استان را انتخاب کنید';
  if (city.replace(/\s+/g, ' ').trim().length < 2) return 'شهر را وارد کنید';
  return '';
}

export function RetailAccountAuth({ redirect }: { redirect: string }) {
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [otpPending, setOtpPending] = useState(false);
  const { secondsLeft, start: startCooldown, reset: resetCooldown } = useSmsResendCooldown();
  const { secondsLeft: validityLeft, start: startValidity, reset: resetValidity } = useSmsResendCooldown();

  const finish = (token: string, role: string) => {
    setToken(token, role, 'retail');
    window.location.href = safeAccountRedirect(redirect);
  };

  const sendOtp = async (fromResend = false) => {
    const identityError = retailIdentityError(name, province, city);
    if (identityError) {
      setError(identityError);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await apiClient.post<{
        message: string;
        phone: string;
        cooldownSeconds?: number;
        expiresInSeconds?: number;
        delivery?: 'sent' | 'pending' | 'failed';
        devCode?: string;
      }>('/auth/retail/otp/request', { phone, name });
      if (res.devCode) setDevCode(res.devCode);
      setPhone(res.phone || phone);
      setOtpPending(res.delivery === 'pending');
      startCooldown(extractSmsCooldown(null, res));
      if (res.expiresInSeconds && res.expiresInSeconds > 0) startValidity(res.expiresInSeconds);
      if (!fromResend) setStep('code');
    } catch (err: unknown) {
      const cooldown = readSmsCooldownSeconds(err);
      if (cooldown != null) startCooldown(cooldown);
      setError(err instanceof Error ? err.message : 'خطا در ارسال کد');
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = async (e: FormEvent) => {
    e.preventDefault();
    await sendOtp(false);
  };

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiClient.post<{ accessToken: string; role: string }>(
        '/auth/retail/otp/verify',
        { phone, code, name: name.trim(), province, city: city.trim() },
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
    <AuthShell brandName="حساب من — ترنم" compact>
      <div className="w-full text-center">
        <BlurFade>
          <p className="auth-card-title">ورود به حساب</p>
        </BlurFade>
        <BlurFade delay={0.1}>
          <p className="mt-2 text-sm text-[var(--brand-muted)]">
            با پیامک وارد شوید یا اگر رمز دارید، از رمز استفاده کنید.
          </p>
        </BlurFade>
      </div>

      <div className="auth-tablist w-full" role="tablist" aria-label="روش ورود">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'otp'}
          className={cn('auth-tab', mode === 'otp' && 'auth-tab--active')}
          onClick={() => {
            setMode('otp');
            setError('');
          }}
        >
          ورود با پیامک
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'password'}
          className={cn('auth-tab', mode === 'password' && 'auth-tab--active')}
          onClick={() => {
            setMode('password');
            setError('');
          }}
        >
          ورود با رمز
        </button>
      </div>

      {error ? (
        <p role="alert" className="w-full rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-[var(--brand-error)]">
          {error}
        </p>
      ) : null}

      {mode === 'otp' && step === 'phone' ? (
        <form onSubmit={requestOtp} className="w-full space-y-4">
          <GlassInput label="نام و نام خانوادگی" htmlFor="retail-name">
            <input
              id="retail-name"
              placeholder="نام و نام خانوادگی"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              aria-label="نام و نام خانوادگی"
            />
          </GlassInput>
          <GlassInput label="استان" htmlFor="retail-province">
            <select
              id="retail-province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              required
              aria-label="استان"
              className="auth-select"
            >
              <option value="">انتخاب استان</option>
              {IRAN_PROVINCES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </GlassInput>
          <GlassInput label="شهر" htmlFor="retail-city">
            <input
              id="retail-city"
              placeholder="شهر"
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              minLength={2}
              aria-label="شهر"
            />
          </GlassInput>
          <GlassInput label="موبایل" htmlFor="retail-phone" icon={<Phone className="h-5 w-5" aria-hidden />}>
            <input
              id="retail-phone"
              type="tel"
              placeholder="09xxxxxxxxx"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
              aria-label="موبایل"
              className="text-start"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
          </GlassInput>
          <GlassButton type="submit" size="full" disabled={busy || secondsLeft > 0} aria-busy={busy}>
            {busy ? 'در حال ارسال…' : secondsLeft > 0 ? `صبر کنید ${secondsLeft}ث` : 'دریافت کد'}
          </GlassButton>
        </form>
      ) : null}

      {mode === 'otp' && step === 'code' ? (
        <form onSubmit={verifyOtp} className="w-full space-y-4">
          <p className="text-center text-sm text-[var(--brand-muted)]">کد به {phone} ارسال شد</p>
          {validityLeft > 0 || otpPending ? <OtpDeliveryNote secondsLeft={validityLeft} pending={otpPending} /> : null}
          {devCode ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
              کد آزمایشی: {devCode}
            </p>
          ) : null}
          <GlassInput label="کد تأیید" htmlFor="retail-otp" icon={<MessageSquare className="h-5 w-5" aria-hidden />}>
            <input
              id="retail-otp"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              dir="ltr"
              aria-label="کد تأیید"
              className="text-center tracking-widest"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
          </GlassInput>
          <GlassButton type="submit" size="full" disabled={busy} aria-busy={busy}>
            {busy ? 'در حال ورود…' : 'تأیید و ورود'}
          </GlassButton>
          <SmsResendButton secondsLeft={secondsLeft} busy={busy} onResend={() => void sendOtp(true)} />
          <button
            type="button"
            className="mx-auto flex min-h-[44px] items-center gap-1.5 text-sm text-[var(--brand-muted)] underline-offset-2 hover:underline"
            onClick={() => {
              setStep('phone');
              resetCooldown();
              resetValidity();
              setOtpPending(false);
              setDevCode('');
              setCode('');
            }}
          >
            <ArrowRight className="h-4 w-4" />
            تغییر شماره
          </button>
        </form>
      ) : null}

      {mode === 'password' ? (
        <form onSubmit={loginPassword} className="w-full space-y-4">
          <GlassInput label="موبایل" htmlFor="retail-phone-pw" icon={<Phone className="h-5 w-5" aria-hidden />}>
            <input
              id="retail-phone-pw"
              type="tel"
              placeholder="09xxxxxxxxx"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
              aria-label="موبایل"
              className="text-start"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
          </GlassInput>
          <GlassInput
            label="رمز عبور"
            htmlFor="retail-password"
            icon={
              <button
                type="button"
                aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
                onClick={() => setShowPassword((v) => !v)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            }
            trailing={<Lock className="h-4 w-4 text-[var(--brand-muted)]" aria-hidden />}
          >
            <input
              id="retail-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="رمز عبور"
              aria-label="رمز عبور"
            />
          </GlassInput>
          <GlassButton type="submit" size="full" disabled={busy} aria-busy={busy}>
            {busy ? 'در حال ورود…' : (
              <span className="inline-flex items-center gap-2">
                ورود
                <ArrowLeft className="h-4 w-4" />
              </span>
            )}
          </GlassButton>
          <p className="text-center text-sm">
            <Link href="/account/forgot-password" className="font-bold text-[var(--color-primary)] hover:underline">
              فراموشی رمز
            </Link>
          </p>
        </form>
      ) : null}
    </AuthShell>
  );
}

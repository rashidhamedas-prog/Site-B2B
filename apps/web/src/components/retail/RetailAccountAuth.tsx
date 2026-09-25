'use client';

import { FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, MessageSquare, Phone } from 'lucide-react';
import { AuthShell, type ConfettiRef } from '@/components/auth/AuthShell';
import { BlurFade } from '@/components/auth/BlurFade';
import { GlassInput } from '@/components/auth/GlassInput';
import { GlassButton } from '@/components/ui/glass-button';
import { apiClient } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { safeAccountRedirect } from '@/lib/safe-redirect';
import { cn } from '@/lib/cn';

export function RetailAccountAuth({ redirect }: { redirect: string }) {
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confettiRef = useRef<ConfettiRef>(null);

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
    <AuthShell brandName="حساب من — ترنم" compact confettiRef={confettiRef}>
      <div className="w-full max-w-[320px] text-center">
        <BlurFade>
          <p className="text-3xl font-extrabold tracking-tight text-[var(--brand-ink)]">ورود به حساب</p>
        </BlurFade>
        <BlurFade delay={0.1}>
          <p className="mt-2 text-sm text-[var(--brand-muted)]">
            با پیامک وارد شوید یا اگر رمز دارید، از رمز استفاده کنید.
          </p>
        </BlurFade>
      </div>

      <div className="grid w-full max-w-[320px] grid-cols-2 gap-1 rounded-full bg-white/50 p-1 backdrop-blur-sm">
        <button
          type="button"
          className={cn(
            'rounded-full py-2 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]',
            mode === 'otp'
              ? 'bg-white text-[var(--color-primary)] shadow-sm'
              : 'text-[var(--brand-muted)]',
          )}
          onClick={() => {
            setMode('otp');
            setError('');
          }}
        >
          ورود با پیامک
        </button>
        <button
          type="button"
          className={cn(
            'rounded-full py-2 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]',
            mode === 'password'
              ? 'bg-white text-[var(--color-primary)] shadow-sm'
              : 'text-[var(--brand-muted)]',
          )}
          onClick={() => {
            setMode('password');
            setError('');
          }}
        >
          ورود با رمز
        </button>
      </div>

      {error ? (
        <p role="alert" className="w-full max-w-[320px] rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-[var(--brand-error)]">
          {error}
        </p>
      ) : null}

      <AnimatePresence mode="wait">
        {mode === 'otp' && step === 'phone' ? (
          <motion.form
            key="otp-phone"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onSubmit={requestOtp}
            className="w-full max-w-[320px] space-y-4"
          >
            <GlassInput>
              <input
                placeholder="نام (اختیاری)"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="نام"
              />
            </GlassInput>
            <GlassInput icon={<Phone className="h-5 w-5" aria-hidden />}>
              <input
                placeholder="09xxxxxxxxx"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                dir="ltr"
                aria-label="موبایل"
                className="text-left"
              />
            </GlassInput>
            <GlassButton type="submit" size="full" disabled={busy}>
              {busy ? '…' : 'دریافت کد'}
            </GlassButton>
          </motion.form>
        ) : null}

        {mode === 'otp' && step === 'code' ? (
          <motion.form
            key="otp-code"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onSubmit={verifyOtp}
            className="w-full max-w-[320px] space-y-4"
          >
            <p className="text-center text-sm text-[var(--brand-muted)]">کد به {phone} ارسال شد</p>
            {devCode ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
                کد آزمایشی: {devCode}
              </p>
            ) : null}
            <GlassInput icon={<MessageSquare className="h-5 w-5" aria-hidden />}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
                inputMode="numeric"
                required
                dir="ltr"
                aria-label="کد تأیید"
                className="text-center text-lg tracking-widest"
              />
            </GlassInput>
            <GlassButton type="submit" size="full" disabled={busy}>
              {busy ? '…' : 'تأیید و ورود'}
            </GlassButton>
            <button
              type="button"
              className="mx-auto flex items-center gap-1.5 text-sm text-[var(--brand-muted)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
              onClick={() => setStep('phone')}
            >
              <ArrowRight className="h-4 w-4" />
              تغییر شماره
            </button>
          </motion.form>
        ) : null}

        {mode === 'password' ? (
          <motion.form
            key="password"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onSubmit={loginPassword}
            className="w-full max-w-[320px] space-y-4"
          >
            <GlassInput icon={<Phone className="h-5 w-5" aria-hidden />}>
              <input
                placeholder="09xxxxxxxxx"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                dir="ltr"
                aria-label="موبایل"
                className="text-left"
              />
            </GlassInput>
            <GlassInput
              icon={
                <button
                  type="button"
                  aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded-full p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              }
              trailing={<Lock className="h-4 w-4 text-[var(--brand-muted)]" aria-hidden />}
            >
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="رمز عبور"
                aria-label="رمز عبور"
              />
            </GlassInput>
            <GlassButton type="submit" size="full" disabled={busy}>
              {busy ? '…' : (
                <span className="inline-flex items-center gap-2">
                  ورود
                  <ArrowLeft className="h-4 w-4" />
                </span>
              )}
            </GlassButton>
            <p className="text-center text-sm">
              <Link
                href="/account/forgot-password"
                className="font-bold text-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
              >
                فراموشی رمز
              </Link>
            </p>
          </motion.form>
        ) : null}
      </AnimatePresence>
    </AuthShell>
  );
}

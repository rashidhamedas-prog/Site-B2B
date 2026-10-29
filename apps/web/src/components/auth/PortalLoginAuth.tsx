'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Phone } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { BlurFade } from '@/components/auth/BlurFade';
import { GlassInput } from '@/components/auth/GlassInput';
import { GlassButton } from '@/components/ui/glass-button';
import { useAuth } from '@/lib/hooks/useAuth';
import { normalizePhone } from '@/lib/phone';
import { cn } from '@/lib/cn';

export function PortalLoginAuth() {
  const { login, loading, error } = useAuth();
  const [step, setStep] = useState<'phone' | 'password'>('phone');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);

  const normalized = normalizePhone(phone);
  const phoneValid = /^09[0-9]{9}$/.test(normalized);
  const passwordValid = password.length >= 6;

  useEffect(() => {
    if (step !== 'password') return;
    const t = window.setTimeout(() => passwordRef.current?.focus(), 100);
    return () => window.clearTimeout(t);
  }, [step]);

  const goPassword = () => {
    setLocalError('');
    if (!phoneValid) {
      setLocalError('شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷)');
      return;
    }
    setStep('password');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!passwordValid) {
      setLocalError('رمز عبور حداقل ۶ کاراکتر باشد');
      return;
    }
    await login({ phone: normalized, password, purpose: 'wholesale' });
  };

  const onKeyDownPhone = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      goPassword();
    }
  };

  return (
    <AuthShell
      brandName="پنل عمده ترنم"
      footer={
        <p className="text-center text-sm text-[var(--brand-muted)]">
          هنوز ثبت‌نام نکرده‌اید؟{' '}
          <a
            href="/portal/register"
            className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
          >
            درخواست عضویت
          </a>
        </p>
      }
    >
      {step === 'phone' ? (
        <div className="w-full text-center">
          <BlurFade>
            <p className="auth-card-title sm:text-2xl">ورود به پنل</p>
          </BlurFade>
          <BlurFade delay={0.12}>
            <p className="mt-2 text-sm text-[var(--brand-muted)]">با شماره موبایل حساب عمده وارد شوید</p>
          </BlurFade>
        </div>
      ) : (
        <div className="w-full text-center">
          <p className="auth-card-title sm:text-2xl">رمز عبور</p>
          <p className="mt-2 text-sm text-[var(--brand-muted)]" dir="ltr">
            {normalized}
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="w-full space-y-5" noValidate>
        {(localError || error) && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-[var(--brand-error,#DC2626)]">
            {localError || error}
          </p>
        )}

        {step === 'phone' ? (
          <div className="space-y-4">
            <GlassInput label="شماره موبایل" htmlFor="portal-phone" icon={<Phone className="h-5 w-5" aria-hidden />}>
              <input
                id="portal-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="09xxxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={onKeyDownPhone}
                dir="ltr"
                aria-label="شماره موبایل"
                className="text-start"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
            </GlassInput>
            <GlassButton type="button" size="full" onClick={goPassword} disabled={!phoneValid}>
              ادامه
            </GlassButton>
          </div>
        ) : (
          <div className="space-y-4">
            <GlassInput
              label="رمز عبور"
              htmlFor="portal-password"
              icon={
                passwordValid ? (
                  <button
                    type="button"
                    aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--brand-ink)]"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                ) : (
                  <Lock className="h-5 w-5" aria-hidden />
                )
              }
              trailing={
                passwordValid ? (
                  <GlassButton
                    type="submit"
                    size="icon"
                    disabled={loading}
                    aria-label="ورود به پنل"
                    contentClassName="text-white"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </GlassButton>
                ) : null
              }
            >
              <input
                ref={passwordRef}
                id="portal-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="رمز عبور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="رمز عبور"
              />
            </GlassInput>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setPassword('');
                  setLocalError('');
                }}
                className={cn(
                  'inline-flex min-h-[44px] items-center gap-1.5 text-[var(--brand-muted)] hover:text-[var(--brand-ink)]',
                )}
              >
                <ArrowRight className="h-4 w-4" />
                بازگشت
              </button>
              <a href="/portal/forgot-password" className="font-medium text-[var(--color-primary)] hover:underline">
                فراموشی رمز
              </a>
            </div>

            <GlassButton type="submit" size="full" disabled={loading || !passwordValid} aria-busy={loading}>
              {loading ? 'در حال ورود…' : 'ورود به پنل'}
            </GlassButton>
          </div>
        )}
      </form>
    </AuthShell>
  );
}

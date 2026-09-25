'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Phone } from 'lucide-react';
import { AuthShell, fireSideCanons, type ConfettiRef } from '@/components/auth/AuthShell';
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
  const confettiRef = useRef<ConfettiRef>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const normalized = normalizePhone(phone);
  const phoneValid = /^09[0-9]{9}$/.test(normalized);
  const passwordValid = password.length >= 6;

  useEffect(() => {
    if (step !== 'password') return;
    const t = window.setTimeout(() => passwordRef.current?.focus(), 350);
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
    // On success useAuth hard-navigates; confetti is best-effort if navigation is slow
    fireSideCanons(confettiRef.current?.fire);
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
      confettiRef={confettiRef}
      footer={
        <p className="text-center text-sm text-[var(--brand-muted)]">
          هنوز ثبت‌نام نکرده‌اید؟{' '}
          <a href="/portal/register" className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
            درخواست عضویت
          </a>
        </p>
      }
    >
      <AnimatePresence mode="wait">
        {step === 'phone' ? (
          <motion.div
            key="phone-title"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full text-center"
          >
            <BlurFade>
              <p className="text-3xl font-extrabold tracking-tight text-[var(--brand-ink)] sm:text-4xl">
                ورود به پنل
              </p>
            </BlurFade>
            <BlurFade delay={0.12}>
              <p className="mt-2 text-sm text-[var(--brand-muted)]">با شماره موبایل حساب عمده وارد شوید</p>
            </BlurFade>
          </motion.div>
        ) : (
          <motion.div
            key="pass-title"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full text-center"
          >
            <p className="text-3xl font-extrabold tracking-tight text-[var(--brand-ink)] sm:text-4xl">
              رمز عبور
            </p>
            <p className="mt-2 text-sm text-[var(--brand-muted)]" dir="ltr">
              {normalized}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={onSubmit} className="w-full max-w-[320px] space-y-5" noValidate>
        {(localError || error) && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-[var(--brand-error,#DC2626)]">
            {localError || error}
          </p>
        )}

        <AnimatePresence mode="wait">
          {step === 'phone' ? (
            <motion.div
              key="phone-field"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <GlassInput
                icon={<Phone className="h-5 w-5" aria-hidden />}
                trailing={
                  phoneValid ? (
                    <GlassButton
                      type="button"
                      size="icon"
                      onClick={goPassword}
                      aria-label="ادامه با موبایل"
                      contentClassName="text-[var(--color-primary)]"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </GlassButton>
                  ) : null
                }
              >
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="09xxxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={onKeyDownPhone}
                  dir="ltr"
                  aria-label="شماره موبایل"
                  className="text-left"
                />
              </GlassInput>
              <GlassButton type="button" size="full" onClick={goPassword} disabled={!phoneValid}>
                ادامه
              </GlassButton>
            </motion.div>
          ) : (
            <motion.div
              key="pass-field"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <GlassInput
                icon={
                  passwordValid ? (
                    <button
                      type="button"
                      aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
                      onClick={() => setShowPassword((v) => !v)}
                      className="rounded-full p-1 text-[var(--brand-ink)]/70 hover:text-[var(--brand-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
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
                      contentClassName="text-[var(--color-primary)]"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </GlassButton>
                  ) : null
                }
              >
                <input
                  ref={passwordRef}
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
                    'inline-flex items-center gap-1.5 text-[var(--brand-muted)] hover:text-[var(--brand-ink)]',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]',
                  )}
                >
                  <ArrowRight className="h-4 w-4" />
                  بازگشت
                </button>
                <a
                  href="/portal/forgot-password"
                  className="font-medium text-[var(--color-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                  فراموشی رمز
                </a>
              </div>

              <GlassButton type="submit" size="full" disabled={loading || !passwordValid}>
                {loading ? 'در حال ورود…' : 'ورود به پنل'}
              </GlassButton>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </AuthShell>
  );
}

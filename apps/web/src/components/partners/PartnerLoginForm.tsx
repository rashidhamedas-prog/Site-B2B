'use client';

import { useState } from 'react';
import { Eye, EyeOff, Lock, Phone } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { BlurFade } from '@/components/auth/BlurFade';
import { GlassInput } from '@/components/auth/GlassInput';
import { GlassButton } from '@/components/ui/glass-button';
import { useAuth } from '@/lib/hooks/useAuth';

export function PartnerLoginForm() {
  const { login, loading, error } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void login({ phone, password, purpose: 'vendor' });
  };

  return (
    <AuthShell brandName="همکاران ترنم">
      <div className="w-full max-w-[320px] text-center">
        <BlurFade>
          <p className="text-3xl font-extrabold tracking-tight text-[var(--brand-ink)]">ورود همکار</p>
        </BlurFade>
        <BlurFade delay={0.1}>
          <p className="mt-2 text-sm leading-7 text-[var(--brand-muted)]">
            سفارش‌هایی که ارسال‌شان با شماست. ثبت‌نام عمومی نیست؛ اگر دعوت نشده‌اید با ترنم تماس بگیرید.
          </p>
        </BlurFade>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-[320px] space-y-4" noValidate>
        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-[var(--brand-error)]">
            {error}
          </p>
        ) : null}

        <GlassInput icon={<Phone className="h-5 w-5" aria-hidden />}>
          <input
            id="partner-phone"
            type="tel"
            inputMode="tel"
            autoComplete="username"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0915…"
            required
            dir="ltr"
            aria-label="شماره موبایل"
            className="text-left"
          />
        </GlassInput>

        <GlassInput
          icon={
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="rounded-full p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
              aria-label={showPass ? 'پنهان کردن رمز' : 'نمایش رمز'}
            >
              {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          }
          trailing={<Lock className="h-4 w-4 text-[var(--brand-muted)]" aria-hidden />}
        >
          <input
            id="partner-password"
            type={showPass ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="رمز موقت"
            aria-label="رمز موقت"
          />
        </GlassInput>

        <GlassButton type="submit" size="full" disabled={loading}>
          {loading ? 'در حال ورود…' : 'ورود به پنل همکار'}
        </GlassButton>
      </form>
    </AuthShell>
  );
}

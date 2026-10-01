'use client';

import { FormEvent, type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SmsResendButton } from '@/components/auth/SmsResendButton';
import { useSmsResendCooldown } from '@/hooks/useSmsResendCooldown';
import { apiClient } from '@/lib/api';
import { normalizePhone } from '@/lib/phone';
import { extractSmsCooldown } from '@/lib/sms-cooldown';

type PublicSettings = {
  enabled: boolean;
  applyOpen: boolean;
  termsVersion: string;
  termsFinal: boolean;
};

type ApplyState = 'idle' | 'otp' | 'done';

const inputClass =
  'w-full min-h-11 rounded-xl border border-stone-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5C4A]';
const buttonClass =
  'w-full min-h-11 rounded-xl bg-[#1B5C4A] font-semibold text-white disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C]';

export function SalesPartnershipApply() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<ApplyState>('idle');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [telegram, setTelegram] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { secondsLeft, start, reset } = useSmsResendCooldown();

  function applyPayload() {
    return {
      displayName: displayName.trim(),
      phone: normalizePhone(phone),
      instagram: instagram.trim() || undefined,
      telegram: telegram.trim() || undefined,
      acceptTerms,
    };
  }

  async function postApplication(opts?: { advanceToOtp?: boolean }): Promise<boolean> {
    setError(null);
    try {
      const res = await apiClient.post<{ cooldownSeconds?: number; remainingSeconds?: number }>(
        '/sales-partner-applications',
        applyPayload(),
      );
      start(extractSmsCooldown(null, res));
      if (opts?.advanceToOtp) setState('otp');
      return true;
    } catch (err) {
      start(extractSmsCooldown(err));
      setError(err instanceof Error ? err.message : 'ارسال درخواست ناموفق بود');
      return false;
    }
  }

  useEffect(() => {
    apiClient
      .get<PublicSettings>('/sales-partner-program/public-settings')
      .then(setSettings)
      .catch(() => setLoadError('تنظیمات برنامه الان در دسترس نیست.'));
  }, []);

  async function submitApply(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    await postApplication({ advanceToOtp: true });
    setBusy(false);
  }

  async function resendApplyOtp() {
    setResendBusy(true);
    await postApplication();
    setResendBusy(false);
  }

  async function submitOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/sales-partner-applications/verify', {
        phone: normalizePhone(phone),
        code: code.trim(),
      });
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'کد تأیید نادرست است');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="apply"
      className="scroll-mt-24 border-t border-[var(--retail-border,#E8E2D9)] bg-[var(--retail-bg,#F6F1E8)] px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="sales-partner-apply-heading"
      dir="rtl"
    >
      <div className="mx-auto max-w-xl text-right">
      <p className="text-sm font-semibold tracking-wide text-[var(--retail-accent,#C9A84C)]">ثبت‌نام</p>
      <h2 id="sales-partner-apply-heading" className="mt-2 text-2xl font-extrabold text-[var(--retail-ink,#0F2F28)]">
        درخواست همکاری بازاریاب
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--retail-muted,#5C6B66)]">
        نام و موبایل را وارد کنید. پس از تأیید پیامک، درخواست برای بررسی ادمین می‌رود. تا تأیید،
        سفارش نمی‌سازید. این نقش با تأمین‌کننده ارسال فرق دارد؛ کالا را انبار یا پست نمی‌کنید.
      </p>

      {loadError && (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {loadError}
        </p>
      )}

      {settings && !settings.applyOpen && (
        <p className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700" role="status">
          ثبت‌نام عمومی الان باز نیست. اگر از قبل حساب دارید، از صفحه ورود همکاران بازاریاب وارد شوید.
        </p>
      )}

      {settings?.applyOpen && state === 'idle' && (
        <form className="mt-8 space-y-4" onSubmit={submitApply}>
          <Field label="نام نمایشی" htmlFor="displayName">
            <input id="displayName" className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} />
          </Field>
          <Field label="شماره موبایل" htmlFor="phone">
            <input id="phone" className={inputClass} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </Field>
          <Field label="اینستاگرام (اختیاری)" htmlFor="instagram">
            <input id="instagram" className={inputClass} value={instagram} onChange={(e) => setInstagram(e.target.value)} />
          </Field>
          <Field label="تلگرام (اختیاری)" htmlFor="telegram">
            <input id="telegram" className={inputClass} value={telegram} onChange={(e) => setTelegram(e.target.value)} />
          </Field>
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input type="checkbox" className="mt-1 min-h-5 min-w-5" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required />
            <span>
              <Link href="/sales-partnership/terms" className="text-[#1B5C4A] underline-offset-4 hover:underline">
                شرایط همکاری نسخه {settings.termsVersion}
              </Link>
              {' '}
              را خواندم و می‌پذیرم
              {settings.termsFinal ? '.' : ' (هنوز نسخه موقت است).'}
            </span>
          </label>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <button type="submit" className={buttonClass} disabled={busy}>
            {busy ? 'در حال ارسال…' : 'ارسال درخواست و دریافت کد'}
          </button>
        </form>
      )}

      {state === 'otp' && (
        <form className="mt-8 space-y-4" onSubmit={submitOtp}>
          <p className="text-sm text-stone-700" role="status">کد پیامک‌شده به {phone} را وارد کنید.</p>
          <Field label="کد تأیید" htmlFor="code">
            <input id="code" className={inputClass} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required />
          </Field>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <button type="submit" className={buttonClass} disabled={busy}>
            {busy ? 'در حال بررسی…' : 'تأیید شماره'}
          </button>
          <SmsResendButton secondsLeft={secondsLeft} onResend={() => void resendApplyOtp()} busy={resendBusy} />
          <button
            type="button"
            className="mx-auto flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5C4A]"
            onClick={() => {
              setState('idle');
              setCode('');
              setError(null);
              reset();
            }}
          >
            <ArrowRight className="h-4 w-4" />
            تغییر شماره
          </button>
        </form>
      )}

      {state === 'done' && (
        <p className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
          درخواست شما ثبت شد و در انتظار بررسی است. تا تأیید ادمین نمی‌توانید سفارش بسازید.
        </p>
      )}

      <p className="mt-10 text-sm">
        <Link className="text-[#1B5C4A] underline-offset-4 hover:underline" href="/sales-partners/login">
          ورود به پنل همکار بازاریاب
        </Link>
      </p>
      </div>
    </section>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-stone-800">
        {label}
      </label>
      {children}
    </div>
  );
}

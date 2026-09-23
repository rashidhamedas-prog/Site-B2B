'use client';

import { FormEvent, type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { normalizePhone } from '@/lib/phone';

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<PublicSettings>('/sales-partner-program/public-settings')
      .then(setSettings)
      .catch(() => setLoadError('تنظیمات برنامه الان در دسترس نیست.'));
  }, []);

  async function submitApply(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/sales-partner-applications', {
        displayName: displayName.trim(),
        phone: normalizePhone(phone),
        instagram: instagram.trim() || undefined,
        telegram: telegram.trim() || undefined,
        acceptTerms,
      });
      setState('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارسال درخواست ناموفق بود');
    } finally {
      setBusy(false);
    }
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
    <main className="mx-auto min-h-screen max-w-xl px-4 py-10 text-right" dir="rtl">
      <p className="text-sm text-stone-500">
        <Link href="/" className="underline-offset-4 hover:underline">
          بازگشت به فروشگاه
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-bold text-stone-900">همکاری بازاریاب با ترنم</h1>
      <p className="mt-3 text-sm leading-7 text-stone-700">
        شما محصول را معرفی و مشتری را برای تصمیم‌گیری راهنمایی می‌کنید. ترنم قیمت، موجودی، پرداخت،
        بسته‌بندی، ارسال و پشتیبانی سفارش را انجام می‌دهد. پورسانت هر سفارش پس از تحویل و پایان مهلت
        مرجوعی قابل‌برداشت می‌شود.
      </p>
      <p className="mt-2 text-sm text-stone-600">
        این نقش با «تأمین‌کننده ارسال» فرق دارد. کالا را انبار یا ارسال نمی‌کنید.
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
    </main>
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

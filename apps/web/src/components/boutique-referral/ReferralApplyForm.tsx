'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

const focus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5C4A]';

type PublicSettings = {
  applyOpen?: boolean;
  canary?: boolean;
  termsFinal?: boolean;
  termsBody?: string;
  termsVersion?: string;
};

export function ReferralApplyForm() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'form' | 'code' | 'done'>('form');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    setLoadingSettings(true);
    setLoadError('');
    try {
      const body = await apiClient.get<PublicSettings>('/boutique-referral/public-settings');
      setSettings(body);
    } catch {
      setLoadError('وضعیت برنامه الان خوانده نشد. کمی بعد دوباره تلاش کنید.');
    } finally {
      setLoadingSettings(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!settings) {
      await loadSettings();
      return;
    }
    if (!settings.termsFinal || !settings.applyOpen) {
      setError('پذیرش درخواست هنوز باز نیست. شرایط پاداش باید اول توسط ترنم تأیید شود.');
      return;
    }
    setPending(true);
    try {
      const result = await apiClient.post<{ status?: string; alreadySubmitted?: boolean; message?: string }>('/boutique-referral/applications', {
        displayName,
        phone,
        termsAccepted: accepted,
      });
      if (result.alreadySubmitted) {
        setStatus(result.status || '');
        setStep('done');
        return;
      }
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت درخواست انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const result = await apiClient.post<{ status: string; message: string }>('/boutique-referral/applications/verify', { phone, code });
      setStatus(result.status);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'کد تأیید نشد.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <Link href="/hamkar-moarefi" className={`text-sm text-[#1B5C4A] ${focus}`}>بازگشت به توضیح برنامه</Link>
      <h1 className="mt-4 text-2xl font-semibold">درخواست همکاری</h1>
      <p className="mt-2 text-sm leading-7">شمارهٔ موبایل تأیید می‌شود و وضعیت واقعی بررسی نشان داده می‌شود. اطلاعات شبا در این مرحله گرفته نمی‌شود.</p>
      {!settings && (
        <button type="button" onClick={loadSettings} className={`mt-4 min-h-11 rounded-full bg-[#1B5C4A] px-5 text-sm text-white ${focus}`} disabled={loadingSettings}>
          {loadingSettings ? 'در حال خواندن شرایط' : 'دیدن شرایط فعلی'}
        </button>
      )}
      {loadError && <p role="alert" className="mt-3 text-sm text-red-700">{loadError}</p>}
      {settings && !settings.applyOpen && (
        <p className="mt-4 rounded-2xl bg-[#F6F1E8] p-4 text-sm leading-7">پذیرش درخواست بسته است. تا تأیید متن شرایط و اعداد پاداش، درخواست جدید ثبت نمی‌شود.</p>
      )}
      {settings?.termsFinal && settings.termsBody && (
        <article className="mt-4 max-h-48 overflow-auto rounded-2xl border p-4 text-sm leading-7 whitespace-pre-wrap">{settings.termsBody}</article>
      )}
      {step === 'form' && settings?.applyOpen && (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm">نام
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required className={`mt-1 h-11 w-full rounded-xl border px-3 ${focus}`} />
          </label>
          <label className="block text-sm">موبایل
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required className={`mt-1 h-11 w-full rounded-xl border px-3 ${focus}`} />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1" />
            <span>نسخهٔ {settings.termsVersion} را خواندم و می‌پذیرم.</span>
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={pending || !accepted} className={`min-h-11 rounded-full bg-[#1B5C4A] px-5 text-sm text-white disabled:opacity-50 ${focus}`}>
            {pending ? 'در حال ارسال' : 'دریافت کد تأیید'}
          </button>
        </form>
      )}
      {step === 'code' && (
        <form onSubmit={verify} className="mt-6 space-y-4">
          <label className="block text-sm">کد پیامک
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" required className={`mt-1 h-11 w-full rounded-xl border px-3 ${focus}`} />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={pending} className={`min-h-11 rounded-full bg-[#1B5C4A] px-5 text-sm text-white ${focus}`}>{pending ? 'در حال بررسی' : 'تأیید شماره'}</button>
        </form>
      )}
      {step === 'done' && (
        <p className="mt-6 rounded-2xl bg-[#F6F1E8] p-4 text-sm leading-7" role="status">وضعیت درخواست: {status === 'PENDING_REVIEW' ? 'در حال بررسی' : status || 'ثبت شد'}</p>
      )}
    </div>
  );
}

'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { safeScopedRedirect } from '@/lib/safe-redirect';

const inputClass =
  'w-full min-h-11 rounded-xl border border-stone-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5C4A]';
const buttonClass =
  'w-full min-h-11 rounded-xl bg-[#1B5C4A] font-semibold text-white disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C]';

export function SalesPartnerLoginForm() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  function goHome(token: string, role: string) {
    setToken(token, role, 'sales_partner');
    const params = new URLSearchParams(window.location.search);
    window.location.href = safeScopedRedirect(params.get('redirect'), '/sales-partners', ['/sales-partners']);
  }

  async function requestOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/sales-partners/auth/otp/request', { phone: normalizePhone(phone) });
      setOtpSent(true);
      setStatus('کد تأیید ارسال شد.');
    } catch (err) {
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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10 text-right" dir="rtl">
      <h1 className="text-2xl font-bold text-stone-900">ورود همکار بازاریاب</h1>
      <p className="mt-2 text-sm text-stone-600">این صفحه برای تأمین‌کننده ارسال نیست.</p>
      <div className="mt-4 flex gap-2">
        <button type="button" className={`min-h-11 flex-1 rounded-xl border px-3 ${mode === 'otp' ? 'border-[#1B5C4A] bg-emerald-50' : 'border-stone-200'}`} onClick={() => setMode('otp')}>
          ورود با پیامک
        </button>
        <button type="button" className={`min-h-11 flex-1 rounded-xl border px-3 ${mode === 'password' ? 'border-[#1B5C4A] bg-emerald-50' : 'border-stone-200'}`} onClick={() => setMode('password')}>
          ورود با رمز
        </button>
      </div>

      {mode === 'otp' && !otpSent && (
        <form className="mt-6 space-y-4" onSubmit={requestOtp}>
          <label className="block text-sm font-medium" htmlFor="phone">شماره موبایل</label>
          <input id="phone" className={inputClass} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <button className={buttonClass} disabled={busy}>{busy ? 'در حال ارسال…' : 'دریافت کد'}</button>
        </form>
      )}

      {mode === 'otp' && otpSent && (
        <form className="mt-6 space-y-4" onSubmit={verifyOtp}>
          <p className="text-sm text-stone-700" role="status">{status}</p>
          <label className="block text-sm font-medium" htmlFor="code">کد تأیید</label>
          <input id="code" className={inputClass} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required />
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <button className={buttonClass} disabled={busy}>{busy ? 'در حال ورود…' : 'ورود'}</button>
        </form>
      )}

      {mode === 'password' && (
        <form className="mt-6 space-y-4" onSubmit={loginPassword}>
          <label className="block text-sm font-medium" htmlFor="phone2">شماره موبایل</label>
          <input id="phone2" className={inputClass} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <label className="block text-sm font-medium" htmlFor="password">رمز عبور</label>
          <input id="password" type="password" className={inputClass} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <button className={buttonClass} disabled={busy}>{busy ? 'در حال ورود…' : 'ورود'}</button>
        </form>
      )}

      <p className="mt-8 text-sm">
        <Link className="text-[#1B5C4A] underline-offset-4 hover:underline" href="/sales-partnership">
          درخواست همکاری
        </Link>
      </p>
    </main>
  );
}

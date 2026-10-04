'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { setToken } from '@/lib/auth';

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5C4A]';

export function ReferralLoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await apiClient.post('/boutique-referral/auth/otp/request', { phone });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارسال کد انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const result = await apiClient.post<{ accessToken: string; role: string }>('/boutique-referral/auth/otp/verify', { phone, code });
      setToken(result.accessToken, result.role, 'boutique_referral');
      router.push('/hamkar-moarefi/panel');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ورود انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">ورود همکار معرفی</h1>
      <p className="mt-2 text-sm leading-7">فقط بعد از تأیید همکاری. این ورود جدا از حساب عمده و همکار بازاریاب است.</p>
      <form onSubmit={sent ? verify : requestCode} className="mt-6 space-y-4">
        <label className="block text-sm">موبایل
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required className={`mt-1 h-11 w-full rounded-xl border px-3 ${focus}`} />
        </label>
        {sent && (
          <label className="block text-sm">کد
            <input value={code} onChange={(e) => setCode(e.target.value)} required className={`mt-1 h-11 w-full rounded-xl border px-3 ${focus}`} />
          </label>
        )}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={pending} className={`min-h-11 rounded-full bg-[#1B5C4A] px-5 text-sm text-white ${focus}`}>
          {pending ? 'لطفاً صبر کنید' : sent ? 'ورود' : 'دریافت کد'}
        </button>
      </form>
    </main>
  );
}

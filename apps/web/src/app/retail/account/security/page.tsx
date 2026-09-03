'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { validateNewPassword } from '@/lib/password-policy';
import { applyPasswordSession } from '@/lib/password-session';
import { PasswordField } from '@/components/account/PasswordField';

export default function RetailSecurityPage() {
  const [phone, setPhone] = useState('');
  const [setPw, setSetPw] = useState({ next: '', confirm: '' });
  const [changePw, setChangePw] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    apiClient
      .get<{ phone?: string }>('/auth/me/profile')
      .then((me) => setPhone(me.phone || ''))
      .catch(() => undefined);
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await fn();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'عملیات ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  const onSet = (e: FormEvent) => {
    e.preventDefault();
    const policy = validateNewPassword(setPw.next, phone);
    if (policy) {
      setErr(policy);
      return;
    }
    if (setPw.next !== setPw.confirm) {
      setErr('تکرار رمز با رمز جدید یکی نیست');
      return;
    }
    void run(async () => {
      const res = await apiClient.post<{ accessToken?: string; role?: string; purpose?: string }>(
        '/auth/me/password/set',
        { password: setPw.next },
      );
      applyPasswordSession(res);
      setMsg('رمز ذخیره شد. از این به بعد می‌توانید با رمز هم وارد شوید.');
      setSetPw({ next: '', confirm: '' });
    });
  };

  const onChange = (e: FormEvent) => {
    e.preventDefault();
    const policy = validateNewPassword(changePw.next, phone);
    if (policy) {
      setErr(policy);
      return;
    }
    if (changePw.next !== changePw.confirm) {
      setErr('تکرار رمز با رمز جدید یکی نیست');
      return;
    }
    void run(async () => {
      const res = await apiClient.patch<{ accessToken?: string; role?: string; purpose?: string }>(
        '/auth/me/password',
        { current: changePw.current, password: changePw.next },
      );
      applyPasswordSession(res);
      setMsg('رمز عبور تغییر کرد.');
      setChangePw({ current: '', next: '', confirm: '' });
    });
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-bold">امنیت حساب</h2>
        <p className="mt-1 text-sm text-[var(--retail-muted)]">
          تعیین رمز تازه فقط بعد از ورود با پیامک ممکن است. اگر رمز فعلی را می‌دانید، از فرم پایین استفاده کنید.
        </p>
      </div>
      {msg ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p> : null}
      {err ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p> : null}

      <form onSubmit={onSet} className="space-y-3 rounded-2xl border border-[var(--retail-border)] bg-white p-4">
        <h3 className="font-bold">تعیین رمز تازه</h3>
        <PasswordField label="رمز جدید" value={setPw.next} onChange={(v) => setSetPw((p) => ({ ...p, next: v }))} autoComplete="new-password" required />
        <PasswordField label="تکرار رمز" value={setPw.confirm} onChange={(v) => setSetPw((p) => ({ ...p, confirm: v }))} autoComplete="new-password" required />
        <button type="submit" disabled={busy} className="rounded-full bg-[var(--retail-gold)] px-5 py-2.5 text-sm font-extrabold text-white">
          ذخیره رمز
        </button>
      </form>

      <form onSubmit={onChange} className="space-y-3 rounded-2xl border border-[var(--retail-border)] bg-white p-4">
        <h3 className="font-bold">تغییر رمز فعلی</h3>
        <PasswordField label="رمز فعلی" value={changePw.current} onChange={(v) => setChangePw((p) => ({ ...p, current: v }))} autoComplete="current-password" required />
        <PasswordField label="رمز جدید" value={changePw.next} onChange={(v) => setChangePw((p) => ({ ...p, next: v }))} autoComplete="new-password" required />
        <PasswordField label="تکرار رمز جدید" value={changePw.confirm} onChange={(v) => setChangePw((p) => ({ ...p, confirm: v }))} autoComplete="new-password" required />
        <button type="submit" disabled={busy} className="rounded-full bg-[var(--retail-primary)] px-5 py-2.5 text-sm font-extrabold text-white">
          تغییر رمز
        </button>
      </form>
    </div>
  );
}

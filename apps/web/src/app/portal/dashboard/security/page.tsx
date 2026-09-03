'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Alert, Button } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { validateNewPassword } from '@/lib/password-policy';
import { applyPasswordSession } from '@/lib/password-session';
import { PasswordField } from '@/components/account/PasswordField';

export default function PortalSecurityPage() {
  const [phone, setPhone] = useState('');
  const [changePw, setChangePw] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get<{ phone?: string }>('/auth/me/profile')
      .then((me) => setPhone(me.phone || ''))
      .catch(() => undefined);
  }, []);

  const onChange = (e: FormEvent) => {
    e.preventDefault();
    const policy = validateNewPassword(changePw.next, phone);
    if (policy) {
      setError(policy);
      return;
    }
    if (changePw.next !== changePw.confirm) {
      setError('تکرار رمز با رمز جدید یکی نیست');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    apiClient
      .patch<{ accessToken?: string; role?: string; purpose?: string }>('/auth/me/password', {
        current: changePw.current,
        password: changePw.next,
      })
      .then((res) => {
        applyPasswordSession(res);
        setSuccess('رمز عبور تغییر کرد.');
        setChangePw({ current: '', next: '', confirm: '' });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'عملیات ناموفق بود'))
      .finally(() => setBusy(false));
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">امنیت و رمز عبور</h1>
        <p className="mt-1 text-sm text-gray-500">
          برای تغییر رمز، رمز فعلی لازم است. اگر رمز را فراموش کرده‌اید از بازیابی پیامکی استفاده کنید.
        </p>
      </div>
      {success ? <Alert variant="success">{success}</Alert> : null}
      {error ? <Alert variant="error" dismissible onDismiss={() => setError('')}>{error}</Alert> : null}

      <form onSubmit={onChange} className="card space-y-4 p-6">
        <h2 className="flex items-center gap-2 font-bold text-gray-900">
          <Lock className="h-4 w-4 text-primary" />
          تغییر رمز فعلی
        </h2>
        <PasswordField label="رمز فعلی" value={changePw.current} onChange={(v) => setChangePw((p) => ({ ...p, current: v }))} autoComplete="current-password" required />
        <PasswordField label="رمز جدید" value={changePw.next} onChange={(v) => setChangePw((p) => ({ ...p, next: v }))} autoComplete="new-password" required hint="حداقل ۸ کاراکتر، بدون فاصله" />
        <PasswordField label="تکرار رمز جدید" value={changePw.confirm} onChange={(v) => setChangePw((p) => ({ ...p, confirm: v }))} autoComplete="new-password" required />
        <Button type="submit" variant="primary" loading={busy}>تغییر رمز عبور</Button>
      </form>

      <p className="text-sm text-gray-500">
        رمز را فراموش کرده‌اید؟{' '}
        <Link href="/portal/forgot-password" className="text-primary hover:underline">بازیابی با پیامک</Link>
      </p>
    </div>
  );
}

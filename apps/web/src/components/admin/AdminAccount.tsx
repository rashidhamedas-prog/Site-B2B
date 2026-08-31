'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CircleUser, KeyRound, Mail, Phone, Save, Shield } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { STAFF_ROLE_LABELS, type StaffRole } from '@/lib/staff-access';

const fieldClass =
  'w-full min-h-11 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

interface MeProfile {
  userId?: string;
  phone?: string;
  email?: string | null;
  role?: string;
  lastLoginAt?: string | null;
}

export function AdminAccount() {
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<MeProfile>('/auth/me/profile')
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setEmail(data.email ?? '');
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'بارگذاری حساب ناموفق بود');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveEmail = async () => {
    setSaving(true);
    setError('');
    setOk('');
    try {
      await apiClient.patch('/auth/me/profile', { email: email.trim() || undefined });
      setOk('ایمیل ذخیره شد');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'ذخیره ایمیل ناموفق بود');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setError('');
    setOk('');
    if (pw.next.length < 8) {
      setError('رمز جدید حداقل ۸ کاراکتر باشد');
      return;
    }
    if (pw.next !== pw.confirm) {
      setError('رمز جدید و تکرار آن یکی نیستند');
      return;
    }
    setPwSaving(true);
    try {
      await apiClient.patch('/auth/me/password', { current: pw.current, password: pw.next });
      setOk('رمز عبور تغییر کرد');
      setPw({ current: '', next: '', confirm: '' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تغییر رمز ناموفق بود');
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    );
  }

  const roleLabel = STAFF_ROLE_LABELS[(profile?.role || '') as StaffRole] || profile?.role || '—';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">حساب من</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          ورود همین کاربر به پنل. نقش «مدیر کل» برای دیگران از{' '}
          <Link href="/admin/users" className="font-medium text-primary hover:underline">
            کاربران ادمین
          </Link>{' '}
          عوض می‌شود. نام نمایشی فروشگاه در{' '}
          <Link href="/admin/settings" className="font-medium text-primary hover:underline">
            تنظیمات ← کسب‌وکار
          </Link>
          است.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          {ok}
        </p>
      ) : null}

      <div className="card space-y-4 p-6">
        <h3 className="flex items-center gap-2 font-bold text-gray-900">
          <CircleUser className="h-4 w-4 text-primary" />
          هویت ورود
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">شماره موبایل</label>
            <div className="flex min-h-11 items-center gap-2 rounded-lg bg-gray-50 px-3 font-mono text-sm text-gray-800" dir="ltr">
              <Phone className="h-4 w-4 text-gray-400" />
              {profile?.phone || '—'}
            </div>
            <p className="mt-1 text-xs text-gray-400">شماره ورود را مدیر کل از کاربران ادمین عوض می‌کند</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">نقش سیستم</label>
            <div className="flex min-h-11 items-center gap-2 rounded-lg bg-gray-50 px-3 text-sm text-gray-800">
              <Shield className="h-4 w-4 text-primary" />
              {roleLabel}
            </div>
          </div>
        </div>
        <div>
          <label htmlFor="staff-email" className="mb-1 block text-xs font-medium text-gray-600">
            ایمیل حساب
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="staff-email"
              type="email"
              name="staff-account-email"
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${fieldClass} pr-10`}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void saveEmail()}
          disabled={saving}
          className="btn btn-primary btn-md inline-flex min-h-11 items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? 'در حال ذخیره...' : 'ذخیره ایمیل'}
        </button>
      </div>

      <div className="card space-y-4 p-6">
        <h3 className="flex items-center gap-2 font-bold text-gray-900">
          <KeyRound className="h-4 w-4 text-primary" />
          تغییر رمز عبور
        </h3>
        <div>
          <label htmlFor="staff-current-password" className="mb-1 block text-xs font-medium text-gray-600">
            رمز فعلی
          </label>
          <input
            id="staff-current-password"
            type="password"
            name="staff-current-password"
            autoComplete="current-password"
            value={pw.current}
            onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="staff-new-password" className="mb-1 block text-xs font-medium text-gray-600">
            رمز جدید (حداقل ۸ کاراکتر)
          </label>
          <input
            id="staff-new-password"
            type="password"
            name="staff-new-password"
            autoComplete="new-password"
            value={pw.next}
            onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="staff-confirm-password" className="mb-1 block text-xs font-medium text-gray-600">
            تکرار رمز جدید
          </label>
          <input
            id="staff-confirm-password"
            type="password"
            name="staff-confirm-password"
            autoComplete="new-password"
            value={pw.confirm}
            onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
            className={fieldClass}
          />
        </div>
        <button
          type="button"
          onClick={() => void changePassword()}
          disabled={pwSaving}
          className="btn btn-outline btn-md min-h-11"
        >
          {pwSaving ? 'در حال تغییر...' : 'تغییر رمز عبور'}
        </button>
      </div>
    </div>
  );
}

'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { SalesPartnerShell, SpAlert, SpCard, SpNote, spField } from '@/components/sales-partners/SalesPartnerShell';
import { SpButton, SpPageSkeleton, useSpToast } from '@/components/sales-partners/SpUi';

type Me = {
  displayName: string;
  phoneMasked: string;
  ibanMasked: string | null;
  statusLabel: string;
  canSetPasswordWithoutCurrent?: boolean;
};

export default function SalesPartnerProfilePage() {
  const toast = useSpToast();
  const [me, setMe] = useState<Me | null>(null);
  const [iban, setIban] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);

  useEffect(() => {
    apiClient
      .get<Me>('/sales-partners/me')
      .then(setMe)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری پروفایل ناموفق بود'));
  }, []);

  async function saveIban() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiClient.patch<Me>('/sales-partners/me/iban', { iban });
      setMe((prev) => ({ ...next, canSetPasswordWithoutCurrent: prev?.canSetPasswordWithoutCurrent }));
      setIban('');
      toast.show('شبا ذخیره شد');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره شبا ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setPwdError(null);
    if (password.length < 8) {
      setPwdError('رمز عبور حداقل ۸ کاراکتر باشد');
      return;
    }
    if (password !== confirmPassword) {
      setPwdError('تکرار رمز با رمز جدید یکی نیست');
      return;
    }
    setPwdBusy(true);
    try {
      const body: { password: string; currentPassword?: string } = { password };
      if (!me?.canSetPasswordWithoutCurrent) {
        if (!currentPassword) {
          setPwdError('رمز فعلی را وارد کنید یا با پیامک وارد شوید');
          setPwdBusy(false);
          return;
        }
        body.currentPassword = currentPassword;
      }
      const res = await apiClient.patch<{
        message: string;
        accessToken: string;
        role: string;
      }>('/sales-partners/me/password', body);
      setToken(res.accessToken, res.role, 'sales_partner');
      setPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      setMe((prev) => (prev ? { ...prev, canSetPasswordWithoutCurrent: false } : prev));
      toast.show(res.message || 'رمز ذخیره شد');
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'ذخیره رمز ناموفق بود');
    } finally {
      setPwdBusy(false);
    }
  }

  return (
    <SalesPartnerShell title="حساب">
      <SpNote>
        شبا برای واریز پورسانت لازم است. شماره کارت کامل ذخیره نمی‌شود؛ فقط شبا. در نمایش فقط چند رقم آخر دیده می‌شود.
      </SpNote>
      {error && (
        <div className="mt-4">
          <SpAlert>{error}</SpAlert>
        </div>
      )}
      {!me && !error && <SpPageSkeleton cards={1} />}
      {me && (
        <SpCard className="mt-4 text-sm">
          <p className="text-lg font-semibold text-stone-900">{me.displayName}</p>
          <p className="mt-1 text-stone-600">
            {me.statusLabel} · <span dir="ltr">{me.phoneMasked}</span>
          </p>
          <p className="mt-3 rounded-xl bg-[#f6f3ee] px-3 py-2">
            شبا فعلی: {me.ibanMasked || 'هنوز ثبت نشده'}
          </p>
        </SpCard>
      )}
      <form
        className="mt-5 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void saveIban();
        }}
      >
        <label className="block text-sm font-medium" htmlFor="sp-iban">
          شماره شبا جدید
        </label>
        <input
          id="sp-iban"
          className={spField}
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          placeholder="IRxxxxxxxxxxxxxxxxxxxxxx"
          dir="ltr"
          autoComplete="off"
        />
        <SpButton type="submit" disabled={busy || !iban.trim()}>
          {busy ? 'در حال ذخیره…' : 'ذخیره شبا'}
        </SpButton>
      </form>

      <SpCard className="mt-8">
        <h2 className="text-base font-semibold text-stone-900">رمز عبور پنل</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {me?.canSetPasswordWithoutCurrent
            ? 'چون با پیامک وارد شده‌اید، می‌توانید الان رمز تعریف کنید و بعداً با رمز وارد شوید.'
            : 'برای تغییر رمز، رمز فعلی را وارد کنید. اگر رمز را فراموش کرده‌اید، با پیامک وارد شوید و دوباره تعریف کنید.'}
        </p>
        <form className="mt-4 space-y-3" onSubmit={savePassword}>
          {!me?.canSetPasswordWithoutCurrent ? (
            <div>
              <label className="block text-sm font-medium" htmlFor="sp-current-password">
                رمز فعلی
              </label>
              <input
                id="sp-current-password"
                type="password"
                className={`${spField} mt-1`}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium" htmlFor="sp-new-password">
              رمز جدید
            </label>
            <input
              id="sp-new-password"
              type="password"
              className={`${spField} mt-1`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="sp-confirm-password">
              تکرار رمز جدید
            </label>
            <input
              id="sp-confirm-password"
              type="password"
              className={`${spField} mt-1`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {pwdError ? <SpAlert>{pwdError}</SpAlert> : null}
          <SpButton type="submit" disabled={pwdBusy}>
            {pwdBusy ? 'در حال ذخیره…' : me?.canSetPasswordWithoutCurrent ? 'تعریف رمز عبور' : 'تغییر رمز عبور'}
          </SpButton>
        </form>
      </SpCard>
    </SalesPartnerShell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { SalesPartnerShell, SpAlert, SpCard, SpNote, spField } from '@/components/sales-partners/SalesPartnerShell';
import { SpButton, SpPageSkeleton, useSpToast } from '@/components/sales-partners/SpUi';

type Me = {
  displayName: string;
  phoneMasked: string;
  ibanMasked: string | null;
  statusLabel: string;
};

export default function SalesPartnerProfilePage() {
  const toast = useSpToast();
  const [me, setMe] = useState<Me | null>(null);
  const [iban, setIban] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      setMe(next);
      setIban('');
      toast.show('شبا ذخیره شد');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره شبا ناموفق بود');
    } finally {
      setBusy(false);
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
          placeholder="IR… (۲۴ رقم بعد از IR)"
          autoComplete="off"
          dir="ltr"
          required
        />
        <p className="text-xs leading-5 text-stone-500">مثال شکل: IR120170000000123456789001</p>
        <SpButton type="submit" className="w-full" disabled={busy}>
          {busy ? 'در حال ذخیره…' : 'ذخیره شبا'}
        </SpButton>
      </form>
    </SalesPartnerShell>
  );
}

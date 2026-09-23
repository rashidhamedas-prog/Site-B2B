'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { SalesPartnerShell } from '@/components/sales-partners/SalesPartnerShell';

type Me = {
  displayName: string;
  phoneMasked: string;
  ibanMasked: string | null;
  statusLabel: string;
};

export default function SalesPartnerProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [iban, setIban] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
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
    setOk(null);
    try {
      const next = await apiClient.patch<Me>('/sales-partners/me/iban', { iban });
      setMe(next);
      setIban('');
      setOk('شبا ذخیره شد. فقط ۴ رقم آخر نمایش داده می‌شود.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره شبا ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SalesPartnerShell title="پروفایل">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{ok}</p>}
      {me && (
        <section className="mt-4 text-sm">
          <p>{me.displayName}</p>
          <p className="mt-1 text-stone-600">{me.statusLabel} · {me.phoneMasked}</p>
          <p className="mt-1">شبا: {me.ibanMasked || 'ثبت نشده'}</p>
        </section>
      )}
      <form
        className="mt-5 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void saveIban();
        }}
      >
        <label className="block text-sm" htmlFor="sp-iban">شماره شبا</label>
        <input
          id="sp-iban"
          className="min-h-11 w-full rounded-xl border px-3"
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          placeholder="IR..."
          autoComplete="off"
          required
        />
        <button type="submit" className="min-h-11 w-full rounded-xl bg-[#1B5C4A] text-white" disabled={busy}>
          ذخیره شبا
        </button>
      </form>
    </SalesPartnerShell>
  );
}

'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5C4A]';

type Intro = {
  id: string;
  stage: string;
  stageLabel: string;
  ownershipStatus: string;
  boutiqueName: string | null;
  normalizedPhone: string;
  partnerName: string;
  internalNote: string | null;
  partnerExplanation: string | null;
  reasonCode: string | null;
};

export function AdminBoutiqueReferrals() {
  const [rows, setRows] = useState<Intro[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const body = await apiClient.get<Intro[]>('/admin/boutique-referrals/introductions');
      setRows(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'صف خوانده نشد.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function update(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setNotice('');
    try {
      await apiClient.patch(`/admin/boutique-referrals/introductions/${id}`, {
        toStatus: String(form.get('toStatus') || ''),
        reasonCode: String(form.get('reasonCode') || ''),
        partnerExplanation: String(form.get('partnerExplanation') || ''),
        internalNote: String(form.get('internalNote') || ''),
        nextAction: String(form.get('nextAction') || ''),
      });
      setNotice('وضعیت ثبت شد.');
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'ثبت وضعیت انجام نشد.');
    }
  }

  return (
    <main className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">معرفی بوتیک عمده</h1>
      <p className="text-sm leading-7">یادداشت داخلی برای همکار فرستاده نمی‌شود. رد و نگهداری بدون کد دلیل ذخیره نمی‌شود.</p>
      {loading && <p>در حال خواندن صف.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {!loading && !rows.length && <p className="text-sm">معرفی‌ای در صف نیست.</p>}
      <ul className="space-y-4">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border p-4">
            <p className="text-sm">{row.partnerName} — {row.boutiqueName || 'بدون نام'} — {row.stageLabel}</p>
            <p className="text-xs text-stone-600">مالکیت: {row.ownershipStatus}</p>
            <form onSubmit={(event) => update(event, row.id)} className="mt-3 grid gap-2 md:grid-cols-2">
              <input name="toStatus" defaultValue={row.stage} aria-label="وضعیت داخلی" className={`h-11 rounded-xl border px-3 ${focus}`} />
              <input name="reasonCode" defaultValue={row.reasonCode || ''} aria-label="کد دلیل" className={`h-11 rounded-xl border px-3 ${focus}`} />
              <input name="partnerExplanation" defaultValue={row.partnerExplanation || ''} aria-label="توضیح قابل‌نمایش" className={`h-11 rounded-xl border px-3 ${focus}`} />
              <input name="nextAction" aria-label="اقدام بعدی" className={`h-11 rounded-xl border px-3 ${focus}`} />
              <textarea name="internalNote" defaultValue={row.internalNote || ''} aria-label="یادداشت داخلی" className={`min-h-20 rounded-xl border p-3 md:col-span-2 ${focus}`} />
              <button className={`min-h-11 rounded-full bg-[#1B5C4A] px-4 text-sm text-white ${focus}`}>ثبت وضعیت</button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}

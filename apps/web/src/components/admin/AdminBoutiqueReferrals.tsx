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

type ReferralSettings = {
  enabled: boolean;
  mode: 'OFF' | 'PREVIEW' | 'CANARY' | 'LIVE';
  applyOpen: boolean;
  termsVersion: string;
  termsBody: string;
  pilotPhones: string[];
  rewardKind: 'RATE_BPS' | 'FIXED' | null;
  rewardRateBps: number | null;
  rewardFixedAmount: number | null;
  rewardCap: number | null;
  ownershipWindowDays: number | null;
  holdDays: number | null;
  minPayout: number | null;
  payoutSchedule: string | null;
  salesResponseTargetHours: number | null;
  boutiqueEligibilityNote: string | null;
};

const field = `h-11 rounded-xl border px-3 ${focus}`;

function ReferralSettingsForm() {
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [denied, setDenied] = useState(false);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ settings: ReferralSettings; missing: string[] }>('/admin/boutique-referrals/settings')
      .then((body) => {
        setSettings(body.settings);
        setMissing(body.missing || []);
      })
      .catch((err: Error & { status?: number }) => {
        if (err.status === 403) setDenied(true);
        else setNotice(err.message || 'قواعد خوانده نشد.');
      });
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rewardKind = String(form.get('rewardKind') || '');
    const payload: Record<string, unknown> = {
      enabled: form.get('enabled') === 'on',
      applyOpen: form.get('applyOpen') === 'on',
      mode: String(form.get('mode') || 'OFF'),
      termsVersion: String(form.get('termsVersion') || '').trim(),
      termsBody: String(form.get('termsBody') || ''),
      pilotPhones: String(form.get('pilotPhones') || '')
        .split(/[\s,،]+/)
        .map((phone) => phone.trim())
        .filter(Boolean),
      payoutSchedule: String(form.get('payoutSchedule') || '').trim(),
      boutiqueEligibilityNote: String(form.get('boutiqueEligibilityNote') || '').trim(),
    };
    if (rewardKind === 'RATE_BPS' || rewardKind === 'FIXED') payload.rewardKind = rewardKind;
    for (const key of [
      'rewardRateBps',
      'rewardFixedAmount',
      'rewardCap',
      'ownershipWindowDays',
      'holdDays',
      'minPayout',
      'salesResponseTargetHours',
    ]) {
      const text = String(form.get(key) ?? '').trim();
      if (!text) continue;
      const value = Number(text);
      if (!Number.isInteger(value) || value < 0) {
        setNotice('عددها باید صحیح و صفر یا بیشتر باشند. نرخ ۱۰۰ یعنی ۱ درصد و مبلغ‌ها به ریال است.');
        return;
      }
      payload[key] = value;
    }
    setSaving(true);
    setNotice('');
    try {
      const body = await apiClient.patch<{ settings: ReferralSettings; missing: string[] }>(
        '/admin/boutique-referrals/settings',
        payload,
      );
      setSettings(body.settings);
      setMissing(body.missing || []);
      setNotice('قواعد ذخیره شد. برنامه فقط وقتی روشن می‌ماند که فهرست موارد لازم خالی باشد.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'ذخیره انجام نشد.');
    } finally {
      setSaving(false);
    }
  }

  if (denied) {
    return (
      <p className="rounded-2xl border p-4 text-sm leading-7">
        قواعد برنامه را فقط مدیر کل می‌تواند ببیند و ذخیره کند. مسیر: مشتریان، معرفی بوتیک.
      </p>
    );
  }

  if (!settings) {
    return (
      <section className="rounded-2xl border p-4 text-sm leading-7">
        {notice || 'در حال خواندن قواعد.'}
      </section>
    );
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-2xl border p-4">
      <h2 className="text-lg font-semibold">قواعد برنامه</h2>
      <p className="text-sm leading-7">
        این‌جا همان جایی است که نسخه و متن شرایط، نرخ یا مبلغ، سقف، مهلت، نگهداری، حداقل پرداخت، زمان واریز، هدف پاسخ فروش و معیار بوتیک وارد می‌شود.
        مبلغ‌ها ریال است. نرخ، نقطهٔ پایه است: ۱۰۰ یعنی ۱ درصد. خالی گذاشتن یک عدد، مقدار قبلی را نگه می‌دارد.
        متن شرایط بعد از نسخهٔ غیر از draft-unreviewed در صفحهٔ عمومی، بخش شرایط، دیده می‌شود. نرخ و مبلغ ثابت خودبه‌خود آنجا منتشر نمی‌شوند.
      </p>
      {missing.length ? (
        <p className="text-sm leading-7" role="status">
          هنوز لازم است: {missing.join('، ')}
        </p>
      ) : (
        <p className="text-sm">موارد لازم برای روشن شدن کامل است. روشن کردن هنوز انتخاب جداگانه است.</p>
      )}
      <label className="grid gap-1 text-sm">
        نسخهٔ شرایط
        <input name="termsVersion" defaultValue={settings?.termsVersion || ''} className={field} />
      </label>
      <label className="grid gap-1 text-sm">
        متن شرایط
        <textarea name="termsBody" defaultValue={settings?.termsBody || ''} className={`min-h-32 rounded-xl border p-3 ${focus}`} />
      </label>
      <label className="grid gap-1 text-sm">
        نوع پاداش
        <select name="rewardKind" defaultValue={settings?.rewardKind || ''} className={field}>
          <option value="">انتخاب نشده</option>
          <option value="RATE_BPS">نرخ، نقطهٔ پایه</option>
          <option value="FIXED">مبلغ ثابت، ریال</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        نرخ (۱۰۰ = ۱٪)
        <input name="rewardRateBps" inputMode="numeric" defaultValue={settings?.rewardRateBps ?? ''} className={field} />
      </label>
      <label className="grid gap-1 text-sm">
        مبلغ ثابت، ریال
        <input name="rewardFixedAmount" inputMode="numeric" defaultValue={settings?.rewardFixedAmount ?? ''} className={field} />
      </label>
      <label className="grid gap-1 text-sm">
        سقف پاداش، ریال. صفر یعنی بدون سقف
        <input name="rewardCap" inputMode="numeric" defaultValue={settings?.rewardCap ?? ''} className={field} />
      </label>
      <label className="grid gap-1 text-sm">
        مهلت مالکیت، روز
        <input name="ownershipWindowDays" inputMode="numeric" defaultValue={settings?.ownershipWindowDays ?? ''} className={field} />
      </label>
      <label className="grid gap-1 text-sm">
        دورهٔ نگهداری، روز. صفر مجاز است
        <input name="holdDays" inputMode="numeric" defaultValue={settings?.holdDays ?? ''} className={field} />
      </label>
      <label className="grid gap-1 text-sm">
        حداقل پرداخت، ریال
        <input name="minPayout" inputMode="numeric" defaultValue={settings?.minPayout ?? ''} className={field} />
      </label>
      <label className="grid gap-1 text-sm">
        زمان واریز
        <input name="payoutSchedule" defaultValue={settings?.payoutSchedule || ''} className={field} />
      </label>
      <label className="grid gap-1 text-sm">
        هدف پاسخ فروش، ساعت
        <input name="salesResponseTargetHours" inputMode="numeric" defaultValue={settings?.salesResponseTargetHours ?? ''} className={field} />
      </label>
      <label className="grid gap-1 text-sm">
        معیار بوتیک مناسب
        <textarea name="boutiqueEligibilityNote" defaultValue={settings?.boutiqueEligibilityNote || ''} className={`min-h-24 rounded-xl border p-3 ${focus}`} />
      </label>
      <label className="grid gap-1 text-sm">
        شماره‌های پایلوت، با فاصله یا ویرگول
        <textarea name="pilotPhones" defaultValue={(settings?.pilotPhones || []).join('\n')} className={`min-h-20 rounded-xl border p-3 ${focus}`} />
      </label>
      <label className="grid gap-1 text-sm">
        حالت
        <select name="mode" defaultValue={settings?.mode || 'OFF'} className={field}>
          <option value="OFF">خاموش</option>
          <option value="PREVIEW">پیش‌نمایش</option>
          <option value="CANARY">آزمایش دعوت‌شده</option>
          <option value="LIVE">اجرای عمومی</option>
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input name="enabled" type="checkbox" defaultChecked={settings?.enabled === true} />
        برنامه روشن باشد
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input name="applyOpen" type="checkbox" defaultChecked={settings?.applyOpen === true} />
        درخواست همکاری در حالت اجرای عمومی دیده شود
      </label>
      <button disabled={saving} className={`min-h-11 rounded-full bg-[#1B5C4A] px-4 text-sm text-white disabled:opacity-60 ${focus}`}>
        {saving ? 'در حال ذخیره' : 'ذخیرهٔ قواعد'}
      </button>
      {notice ? <p role="status" className="text-sm leading-7">{notice}</p> : null}
    </form>
  );
}

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
      <ReferralSettingsForm />
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

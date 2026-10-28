'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { ensureOptOutFooter, normalizeTypedCount } from './sms-parts';
import { PartsCounter, PhonePreview, SmsSection } from './sms-ui';
import {
  AudienceSourceSelector,
  ConfirmDialog,
  RecipientPreviewPanel,
  ScheduleField,
  SegmentBuilder,
  buildCitySegmentRules,
  priceCaption,
} from './sms-send-ui';
import './sms-wizard.css';

const STEPS = ['مخاطب', 'پیام', 'زمان', 'بازبینی', 'تأیید'];

export function AdminSmsWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('کمپین جدید');
  const [messageClass, setMessageClass] = useState<'PROMO' | 'TRANSACTIONAL'>('PROMO');
  const [body, setBody] = useState('');
  const [csv, setCsv] = useState('');
  const [listId, setListId] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [token, setToken] = useState('');
  const [typedCount, setTypedCount] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sources, setSources] = useState<string[]>(['WHOLESALE', 'RETAIL']);
  const [city, setCity] = useState('');
  const [schedule, setSchedule] = useState('');
  const [unitPrice, setUnitPrice] = useState<number | null>(null);

  const previewBody = useMemo(() => ensureOptOutFooter(body, messageClass), [body, messageClass]);
  const cityRules = useMemo(() => buildCitySegmentRules(city), [city]);

  useEffect(() => {
    apiClient
      .get<{ unitPricePerPart?: number | null }>('/admin/sms/settings')
      .then((row) => setUnitPrice(row.unitPricePerPart ?? null))
      .catch(() => {});
  }, []);

  const createListAndCampaign = async () => {
    setBusy(true);
    setError(null);
    try {
      const list = await apiClient.post<any>('/admin/sms/lists', { name: `لیست ${name}` });
      await apiClient.post(`/admin/sms/lists/${list.id}/import`, { csv });
      const rules = cityRules;
      const camp = await apiClient.post<any>('/admin/sms/campaigns', {
        name,
        messageClass,
        body: previewBody,
        listId: list.id,
        audienceSpec: sources.length ? { sources, rules } : undefined,
        scheduledAt: schedule ? new Date(schedule).toISOString() : undefined,
      });
      setListId(list.id);
      setCampaignId(camp.id);
      const p = await apiClient.post(`/admin/sms/campaigns/${camp.id}/preview`, {});
      setPreview(p);
      setStep(3);
    } catch (e: any) {
      setError(e?.message || 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const prepare = async () => {
    if (!campaignId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post<any>(`/admin/sms/campaigns/${campaignId}/prepare`, {});
      setToken(res.confirmationToken);
      setStep(4);
    } catch (e: any) {
      setError(e?.message || 'آماده‌سازی ناموفق');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!campaignId) return;
    setBusy(true);
    setError(null);
    try {
      const camp = await apiClient.post<any>(`/admin/sms/campaigns/${campaignId}/confirm`, {
        token,
        typedCount: normalizeTypedCount(typedCount),
        otp,
      });
      if (camp.status === 'AWAITING_APPROVAL') {
        router.push(`/admin/sms/campaigns/${campaignId}/approval`);
      } else {
        router.push(`/admin/sms/campaigns/${campaignId}`);
      }
    } catch (e: any) {
      setError(e?.message || 'تأیید ناموفق');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sms-wizard space-y-4">
      <ol className="flex flex-wrap gap-2" aria-label="مراحل ویزارد">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? 'step' : undefined}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              i === step ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {s}
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {step === 0 && (
        <SmsSection title="مخاطب">
          <label className="mb-3 block text-sm">
            نوع پیام
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={messageClass}
              onChange={(e) => setMessageClass(e.target.value as 'PROMO' | 'TRANSACTIONAL')}
              aria-label="نوع پیام"
            >
              <option value="PROMO">تبلیغاتی</option>
              <option value="TRANSACTIONAL">خدماتی</option>
            </select>
          </label>
          <AudienceSourceSelector value={sources} onChange={setSources} />
          <div className="mt-3">
            <SegmentBuilder city={city} onCity={setCity} />
          </div>
          <div className="mt-3">
            <RecipientPreviewPanel
              sources={sources}
              previewBody={previewBody}
              messageClass={messageClass}
              rules={cityRules}
            />
          </div>
          <textarea
            className="min-h-[140px] w-full rounded-lg border border-gray-200 p-3 text-sm ltr text-left"
            placeholder="0912… یک شماره در هر خط"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <input
            className="mt-2 block w-full text-sm"
            type="file"
            accept=".csv,text/plain"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setCsv(await f.text());
            }}
          />
          <button
            type="button"
            className="mt-3 min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-white"
            onClick={() => setStep(1)}
          >
            ادامه
          </button>
        </SmsSection>
      )}

      {step === 1 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <SmsSection title="پیام">
            <input
              className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="نام کمپین"
            />
            <select
              className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
              value={messageClass}
              onChange={(e) => setMessageClass(e.target.value as any)}
            >
              <option value="PROMO">تبلیغاتی</option>
              <option value="TRANSACTIONAL">خدماتی</option>
            </select>
            <textarea
              className="min-h-[120px] w-full rounded-lg border p-3 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <PartsCounter body={previewBody} />
            <div className="mt-3 flex gap-2">
              <button type="button" className="min-h-11 rounded-lg border px-4 text-sm" onClick={() => setStep(0)}>
                بازگشت
              </button>
              <button
                type="button"
                className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-white"
                onClick={() => setStep(2)}
              >
                ادامه
              </button>
            </div>
          </SmsSection>
          <PhonePreview body={previewBody} messageClass={messageClass} />
        </div>
      )}

      {step === 2 && (
        <SmsSection title="زمان ارسال">
          <ScheduleField value={schedule} onChange={setSchedule} />
          <p className="mt-2 text-sm text-gray-600">{priceCaption(unitPrice) || 'ارسال داخل پنجره ۰۸ تا ۲۱'}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="min-h-11 rounded-lg border px-4 text-sm" onClick={() => setStep(1)}>
              بازگشت
            </button>
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:opacity-60"
              onClick={createListAndCampaign}
            >
              {busy ? '…' : 'بازبینی'}
            </button>
          </div>
        </SmsSection>
      )}

      {step === 3 && preview && (
        <SmsSection title="بازبینی">
          <ul className="space-y-1 text-sm text-gray-700">
            <li>واجد: {(preview.eligible || 0).toLocaleString('fa-IR')}</li>
            <li>
              برآورد: ≈ {(preview.estimatedParts || 0).toLocaleString('fa-IR')} پیامک از{' '}
              {(preview.credit || 0).toLocaleString('fa-IR')} پیامک
            </li>
            <li>{preview.priceCaption || priceCaption(preview.unitPricePerPart ?? unitPrice)}</li>
            {preview.insufficient && (
              <li className="text-red-700" role="alert">
                اعتبار ناکافی — ارسال بلاک است
              </li>
            )}
          </ul>
          <div className="mt-3 flex gap-2">
            <button type="button" className="min-h-11 rounded-lg border px-4 text-sm" onClick={() => setStep(2)}>
              بازگشت
            </button>
            <button
              type="button"
              disabled={busy || preview.insufficient}
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:opacity-60"
              onClick={prepare}
            >
              آماده‌سازی برای تأیید
            </button>
          </div>
        </SmsSection>
      )}

      {step === 4 && (
        <SmsSection title="تأیید نهایی">
          <ConfirmDialog
            count={Number(preview?.eligible || 0)}
            typedCount={typedCount}
            otp={otp}
            busy={busy}
            onTypedCount={setTypedCount}
            onOtp={setOtp}
            onCancel={() => setStep(3)}
            onConfirm={confirm}
          />
          {listId && <p className="mt-2 text-xs text-gray-400">list={listId}</p>}
        </SmsSection>
      )}
    </div>
  );
}

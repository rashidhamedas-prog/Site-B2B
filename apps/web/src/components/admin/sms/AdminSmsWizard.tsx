'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { ensureOptOutFooter, normalizeTypedCount } from './sms-parts';
import { PartsCounter, PhonePreview, SmsSection } from './sms-ui';
import {
  AudienceContinueButton,
  AudienceSourceSelector,
  ConfirmDialog,
  ManualNumbersField,
  RecipientPreviewPanel,
  ScheduleField,
  SegmentBuilder,
  WIZARD_STEPS,
  buildCitySegmentRules,
  countManualPhones,
  mergeSegmentRules,
  priceCaption,
  visualWizardStep,
  type SegmentFilterRule,
} from './sms-send-ui';
import type { PreviewPanelView } from './sms-send-preview';
import './sms-wizard.css';

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
  const [cities, setCities] = useState<string[]>([]);
  const [filterRules, setFilterRules] = useState<SegmentFilterRule[]>([]);
  const [schedule, setSchedule] = useState('');
  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  const [previewView, setPreviewView] = useState<PreviewPanelView>({
    phase: 'idle',
    funnel: null,
    displayFunnel: null,
    faded: false,
    banner: null,
    bannerTone: null,
    zeroReason: null,
  });

  const previewBody = useMemo(() => ensureOptOutFooter(body, messageClass), [body, messageClass]);
  const cityRules = useMemo(() => buildCitySegmentRules(cities), [cities]);
  const allRules = useMemo(
    () => mergeSegmentRules(cityRules, filterRules),
    [cityRules, filterRules],
  );
  const visualStep = visualWizardStep(step);
  const manualCount = countManualPhones(csv);

  const onPreviewViewChange = useCallback((view: PreviewPanelView) => {
    setPreviewView(view);
  }, []);

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
      const rules = allRules;
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
      {step === 0 ? (
        <h1 className="sms-page-title">ارسال انبوه — مخاطبان</h1>
      ) : (
        <h1 className="sms-page-title">ارسال انبوه</h1>
      )}

      <ol className="sms-steps" aria-label="مراحل ارسال انبوه">
        {WIZARD_STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === visualStep ? 'step' : undefined}
            className={`sms-step${i === visualStep ? ' sms-step-current' : ''}${
              i < visualStep ? ' sms-step-done' : ''
            }`}
          >
            <span className="sms-step-num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="sms-step-label">{label}</span>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {step === 0 && (
        <div className="sms-audience-grid">
          <div className="sms-audience-form">
            <SmsSection title="مخاطبان">
              <label className="mb-3 block text-sm">
                نوع پیام
                <select
                  className="sms-input mt-1"
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
                <SegmentBuilder
                  cities={cities}
                  onCities={setCities}
                  sources={sources}
                  onSources={setSources}
                  filterRules={filterRules}
                  onFilterRules={setFilterRules}
                />
              </div>
              <div className="mt-3">
                <ManualNumbersField value={csv} onChange={setCsv} />
              </div>
              <AudienceContinueButton
                phase={previewView.phase}
                final={previewView.funnel?.final ?? 0}
                manualCount={manualCount}
                onClick={() => setStep(1)}
              />
            </SmsSection>
          </div>
          <RecipientPreviewPanel
            sources={sources}
            previewBody={previewBody}
            messageClass={messageClass}
            rules={allRules}
            manualCsv={csv}
            onViewChange={onPreviewViewChange}
          />
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <SmsSection title="متن">
            <input
              className="sms-input mb-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="نام کمپین"
            />
            <select
              className="sms-input mb-2"
              value={messageClass}
              onChange={(e) => setMessageClass(e.target.value as any)}
            >
              <option value="PROMO">تبلیغاتی</option>
              <option value="TRANSACTIONAL">خدماتی</option>
            </select>
            <textarea
              className="sms-input sms-textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <PartsCounter body={previewBody} />
            <div className="mt-3 flex gap-2">
              <button type="button" className="sms-btn" onClick={() => setStep(0)}>
                بازگشت
              </button>
              <button
                type="button"
                className="sms-btn sms-btn-primary"
                onClick={() => setStep(2)}
              >
                بعدی: زمان‌بندی
              </button>
            </div>
          </SmsSection>
          <PhonePreview body={previewBody} messageClass={messageClass} />
        </div>
      )}

      {step === 2 && (
        <SmsSection title="زمان‌بندی">
          <ScheduleField value={schedule} onChange={setSchedule} />
          <p className="mt-2 text-sm text-gray-600">{priceCaption(unitPrice) || 'ارسال داخل پنجره ۰۸ تا ۲۱'}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="sms-btn" onClick={() => setStep(1)}>
              بازگشت
            </button>
            <button
              type="button"
              disabled={busy}
              className="sms-btn sms-btn-primary disabled:opacity-60"
              onClick={createListAndCampaign}
            >
              {busy ? '…' : 'بعدی: بازبینی و تأیید'}
            </button>
          </div>
        </SmsSection>
      )}

      {step === 3 && preview && (
        <SmsSection title="بازبینی و تأیید">
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
            <button type="button" className="sms-btn" onClick={() => setStep(2)}>
              بازگشت
            </button>
            <button
              type="button"
              disabled={busy || preview.insufficient}
              className="sms-btn sms-btn-primary disabled:opacity-60"
              onClick={prepare}
            >
              آماده‌سازی برای تأیید
            </button>
          </div>
        </SmsSection>
      )}

      {step === 4 && (
        <SmsSection title="بازبینی و تأیید">
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

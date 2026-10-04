'use client';

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { OtpDeliveryNote } from '@/components/auth/OtpDeliveryNote';
import { SmsResendButton } from '@/components/auth/SmsResendButton';
import { useSmsResendCooldown } from '@/hooks/useSmsResendCooldown';
import { apiClient } from '@/lib/api';
import { normalizeDigits, normalizeOtpCode, normalizePhone } from '@/lib/phone';
import { DEFAULT_SALES_PARTNER_SMS_COOLDOWN, extractSmsCooldown, readSmsCooldownSeconds } from '@/lib/sms-cooldown';
import { SpButton, SpStepRail, spFocusClass } from './SpUi';

type ApplyFormField = {
  key: string;
  enabled: boolean;
  required: boolean;
  label: string;
  order: number;
  type: 'text' | 'textarea' | 'select' | 'phone' | 'national_id' | 'checkbox';
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
};

type PublicSettings = {
  enabled: boolean;
  applyOpen: boolean;
  termsVersion: string;
  termsFinal: boolean;
  applyFormFields?: ApplyFormField[];
};

type ApplyState = 'idle' | 'otp' | 'done';

const inputClass = `w-full min-h-11 rounded-2xl border border-stone-300 bg-white px-3 py-2 transition-shadow ${spFocusClass}`;

const FALLBACK_FIELDS: ApplyFormField[] = [
  { key: 'displayName', enabled: true, required: true, label: 'نام نمایشی', order: 10, type: 'text', maxLength: 80 },
  { key: 'phone', enabled: true, required: true, label: 'شماره موبایل', order: 20, type: 'phone', maxLength: 11 },
  { key: 'province', enabled: true, required: true, label: 'استان', order: 30, type: 'text', maxLength: 80 },
  { key: 'city', enabled: true, required: true, label: 'شهر', order: 40, type: 'text', maxLength: 80 },
  { key: 'nationalId', enabled: true, required: true, label: 'کد ملی', order: 50, type: 'national_id', maxLength: 10 },
  {
    key: 'salesExperience',
    enabled: true,
    required: true,
    label: 'سابقه فروش',
    order: 60,
    type: 'select',
    options: [
      { value: 'none', label: 'تازه‌کار' },
      { value: 'under_1y', label: 'کمتر از ۱ سال' },
      { value: '1_to_3y', label: '۱ تا ۳ سال' },
      { value: 'over_3y', label: 'بیش از ۳ سال' },
    ],
  },
  {
    key: 'primaryChannel',
    enabled: true,
    required: true,
    label: 'کانال اصلی فروش',
    order: 70,
    type: 'select',
    options: [
      { value: 'instagram', label: 'اینستاگرام' },
      { value: 'telegram', label: 'تلگرام' },
      { value: 'in_person', label: 'حضوری' },
      { value: 'website', label: 'سایت' },
      { value: 'other', label: 'سایر' },
    ],
  },
  { key: 'instagram', enabled: true, required: false, label: 'آیدی اینستاگرام', order: 80, type: 'text', maxLength: 80 },
  { key: 'telegram', enabled: true, required: false, label: 'آیدی تلگرام', order: 90, type: 'text', maxLength: 80 },
  { key: 'referrer', enabled: true, required: false, label: 'معرفی‌کننده', order: 100, type: 'text', maxLength: 120 },
  { key: 'motivation', enabled: true, required: true, label: 'چرا همکاری؟', order: 110, type: 'textarea', maxLength: 500 },
  { key: 'acceptTerms', enabled: true, required: true, label: 'پذیرش شرایط همکاری', order: 120, type: 'checkbox' },
];

export function SalesPartnershipApply() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<ApplyState>('idle');
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { secondsLeft, start, reset } = useSmsResendCooldown();
  const { secondsLeft: validityLeft, start: startValidity, reset: resetValidity } = useSmsResendCooldown();
  const [otpPending, setOtpPending] = useState(false);

  const fields = useMemo(() => {
    const list = settings?.applyFormFields?.length ? settings.applyFormFields : FALLBACK_FIELDS;
    return [...list].filter((f) => f.enabled).sort((a, b) => a.order - b.order);
  }, [settings]);

  function setField(key: string, value: string | boolean) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function applyPayload() {
    const phoneRaw = String(values.phone || '');
    const payload: Record<string, unknown> = {
      displayName: String(values.displayName || '').trim(),
      phone: normalizePhone(phoneRaw),
      acceptTerms: values.acceptTerms === true,
      answers: {} as Record<string, string | boolean>,
    };
    for (const field of fields) {
      if (field.key === 'displayName' || field.key === 'phone' || field.key === 'acceptTerms') continue;
      const v = values[field.key];
      if (v === undefined || v === '') continue;
      if (field.key === 'instagram' || field.key === 'telegram') {
        payload[field.key] = String(v).trim();
      }
      let stored: string | boolean = typeof v === 'boolean' ? v : String(v).trim();
      if (typeof stored === 'string' && (field.type === 'national_id' || field.key === 'nationalId')) {
        stored = normalizeDigits(stored);
      }
      (payload.answers as Record<string, string | boolean>)[field.key] = stored;
      payload[field.key] = stored;
    }
    return payload;
  }

  async function postApplication(opts?: { advanceToOtp?: boolean }): Promise<boolean> {
    setError(null);
    try {
      const res = await apiClient.post<{
        cooldownSeconds?: number;
        remainingSeconds?: number;
        expiresInSeconds?: number;
        delivery?: 'sent' | 'pending' | 'failed';
      }>('/sales-partner-applications', applyPayload());
      const seconds = extractSmsCooldown(null, res);
      start(seconds > 0 ? seconds : DEFAULT_SALES_PARTNER_SMS_COOLDOWN);
      setOtpPending(res.delivery === 'pending');
      if (res.expiresInSeconds && res.expiresInSeconds > 0) startValidity(res.expiresInSeconds);
      if (opts?.advanceToOtp) setState('otp');
      return true;
    } catch (err) {
      const seconds = readSmsCooldownSeconds(err);
      if (seconds != null) start(seconds);
      setError(err instanceof Error ? err.message : 'ارسال درخواست ناموفق بود');
      return false;
    }
  }

  useEffect(() => {
    apiClient
      .get<PublicSettings>('/sales-partner-program/public-settings')
      .then(setSettings)
      .catch(() => setLoadError('تنظیمات برنامه الان در دسترس نیست.'));
  }, []);

  async function submitApply(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await postApplication({ advanceToOtp: true });
    } finally {
      setBusy(false);
    }
  }

  async function resendApplyOtp() {
    setResendBusy(true);
    try {
      await postApplication();
    } finally {
      setResendBusy(false);
    }
  }

  async function submitOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/sales-partner-applications/verify', {
        phone: normalizePhone(String(values.phone || '')),
        code: normalizeOtpCode(code),
      });
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'کد تأیید نادرست است');
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = state === 'idle' ? 0 : state === 'otp' ? 1 : 2;
  const phoneDisplay = String(values.phone || '');

  return (
    <section
      id="apply"
      className="scroll-mt-24 border-t border-[var(--retail-border,#E8E2D9)] bg-[var(--retail-bg,#F6F1E8)] px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="sales-partner-apply-heading"
      dir="rtl"
    >
      <div className="mx-auto max-w-xl text-right">
        <p className="text-sm font-semibold tracking-wide text-[var(--retail-accent,#C9A84C)]">ثبت‌نام</p>
        <h2 id="sales-partner-apply-heading" className="mt-2 text-2xl font-extrabold text-[var(--retail-ink,#0F2F28)]">
          درخواست همکاری بازاریاب
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--retail-muted,#5C6B66)]">
          اطلاعات لازم را کامل کنید. بعد از تأیید پیامک، درخواست برای بررسی فروشگاه می‌رود. تا تأیید، لینک فروش و سفارش
          نمی‌سازید.
        </p>

        <div className="mt-8 rounded-3xl border border-stone-200/80 bg-white/80 p-5 shadow-sm shadow-stone-900/5 backdrop-blur-sm sm:p-6">
          {!loadError && settings?.applyOpen ? (
            <SpStepRail steps={['اطلاعات', 'پیامک', 'نتیجه']} current={stepIndex} />
          ) : null}

          {loadError && (
            <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {loadError}
            </p>
          )}

          {settings && !settings.applyOpen && (
            <p className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700" role="status">
              ثبت‌نام عمومی الان باز نیست. اگر از قبل حساب دارید، از صفحه ورود همکاران بازاریاب وارد شوید.
            </p>
          )}

          {settings?.applyOpen && state === 'idle' && (
            <form className="space-y-4" onSubmit={submitApply}>
              {fields.map((field) => {
                if (field.type === 'checkbox' && field.key === 'acceptTerms') {
                  return (
                    <label key={field.key} className="flex items-start gap-2 text-sm leading-6 text-stone-700">
                      <input
                        type="checkbox"
                        className="mt-1 min-h-5 min-w-5 rounded border-stone-300"
                        checked={values.acceptTerms === true}
                        onChange={(e) => setField('acceptTerms', e.target.checked)}
                        required={field.required}
                      />
                      <span>
                        <Link
                          href="/sales-partnership/terms"
                          className="font-medium text-[#1B5C4A] underline-offset-4 hover:underline"
                        >
                          شرایط همکاری نسخه {settings.termsVersion}
                        </Link>{' '}
                        را خواندم و می‌پذیرم
                        {settings.termsFinal ? '.' : ' (هنوز نسخه موقت است).'}
                      </span>
                    </label>
                  );
                }

                if (field.type === 'textarea') {
                  return (
                    <Field key={field.key} label={field.label} htmlFor={field.key} required={field.required}>
                      <textarea
                        id={field.key}
                        className={`${inputClass} min-h-24`}
                        value={String(values[field.key] || '')}
                        onChange={(e) => setField(field.key, e.target.value)}
                        required={field.required}
                        maxLength={field.maxLength || 500}
                      />
                    </Field>
                  );
                }

                if (field.type === 'select') {
                  return (
                    <Field key={field.key} label={field.label} htmlFor={field.key} required={field.required}>
                      <select
                        id={field.key}
                        className={inputClass}
                        value={String(values[field.key] || '')}
                        onChange={(e) => setField(field.key, e.target.value)}
                        required={field.required}
                      >
                        <option value="">انتخاب کنید</option>
                        {(field.options || []).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  );
                }

                const isLtr =
                  field.type === 'phone' ||
                  field.type === 'national_id' ||
                  field.key === 'instagram' ||
                  field.key === 'telegram';
                const isNumericField = field.type === 'phone' || field.type === 'national_id';

                return (
                  <Field key={field.key} label={field.label} htmlFor={field.key} required={field.required}>
                    <input
                      id={field.key}
                      className={inputClass}
                      value={String(values[field.key] || '')}
                      onChange={(e) => setField(field.key, e.target.value)}
                      onBlur={(e) => {
                        if (!isNumericField) return;
                        const normalized =
                          field.type === 'phone'
                            ? normalizePhone(e.target.value)
                            : normalizeDigits(e.target.value);
                        if (normalized) setField(field.key, normalized);
                      }}
                      required={field.required}
                      maxLength={field.maxLength}
                      inputMode={isNumericField ? 'numeric' : undefined}
                      autoComplete={field.key === 'phone' ? 'tel' : field.key === 'displayName' ? 'name' : undefined}
                      dir={isLtr ? 'ltr' : undefined}
                      placeholder={
                        field.key === 'phone'
                          ? '09xxxxxxxxx'
                          : field.key === 'instagram' || field.key === 'telegram'
                            ? '@username'
                            : undefined
                      }
                    />
                  </Field>
                );
              })}
              {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
              <SpButton type="submit" className="w-full" disabled={busy}>
                {busy ? 'در حال ارسال…' : 'ادامه و دریافت کد'}
              </SpButton>
            </form>
          )}

          {state === 'otp' && (
            <form className="space-y-4" onSubmit={submitOtp}>
              <p className="rounded-2xl bg-[#1B5C4A]/5 px-3 py-2 text-sm text-stone-700" role="status">
                کد پیامک‌شده به <span dir="ltr" className="font-medium">{phoneDisplay}</span> را وارد کنید.
              </p>
              {validityLeft > 0 || otpPending ? <OtpDeliveryNote secondsLeft={validityLeft} pending={otpPending} /> : null}
              <Field label="کد تأیید" htmlFor="code">
                <input
                  id="code"
                  className={`${inputClass} text-center tracking-[0.35em]`}
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  dir="ltr"
                  autoComplete="one-time-code"
                />
              </Field>
              {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
              <SpButton type="submit" className="w-full" disabled={busy}>
                {busy ? 'در حال بررسی…' : 'تأیید شماره'}
              </SpButton>
              <SmsResendButton secondsLeft={secondsLeft} onResend={() => void resendApplyOtp()} busy={resendBusy} />
              <button
                type="button"
                className={`mx-auto flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 ${spFocusClass}`}
                onClick={() => {
                  setState('idle');
                  setCode('');
                  setError(null);
                  setOtpPending(false);
                  reset();
                  resetValidity();
                }}
              >
                <ArrowRight className="h-4 w-4" />
                بازگشت به فرم
              </button>
            </form>
          )}

          {state === 'done' && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-950" role="status">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
                <div>
                  <p className="font-semibold">درخواست ثبت شد</p>
                  <p className="mt-1">
                    در انتظار بررسی فروشگاه هستید. تا تأیید، نمی‌توانید لینک بفرستید یا سفارش بسازید. بعد از تأیید، از صفحه
                    ورود وارد پنل شوید.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="mt-8 text-sm">
          <Link className="font-medium text-[#1B5C4A] underline-offset-4 hover:underline" href="/sales-partners/login">
            ورود به پنل همکار بازاریاب
          </Link>
        </p>
      </div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-stone-800">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

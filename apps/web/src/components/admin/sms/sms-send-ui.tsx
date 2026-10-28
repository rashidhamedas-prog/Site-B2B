'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { normalizeTypedCount } from './sms-parts';

const SOURCES = [
  { id: 'WHOLESALE', label: 'عمده' },
  { id: 'WHOLESALE_REFERRAL', label: 'معرف' },
  { id: 'SALES_PARTNER', label: 'همکار فروش' },
  { id: 'RETAIL', label: 'خرده' },
] as const;

export function priceCaption(unitPricePerPart: number | null | undefined): string {
  return unitPricePerPart == null ? 'قیمت تنظیم نشده' : '';
}

export function AudienceSourceSelector({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="sms-src-grid" role="group" aria-label="منابع مخاطب">
      {SOURCES.map((source) => (
        <label key={source.id} className="sms-src-label">
          <input
            type="checkbox"
            className="sms-src-check"
            checked={value.includes(source.id)}
            onChange={() => {
              const next = value.includes(source.id)
                ? value.filter((id) => id !== source.id)
                : [...value, source.id];
              onChange(next);
            }}
          />
          <span>{source.label}</span>
        </label>
      ))}
    </div>
  );
}

export function SegmentBuilder({
  city,
  onCity,
}: {
  city: string;
  onCity: (value: string) => void;
}) {
  return (
    <div className="sms-rule-row">
      <label className="text-sm">
        شهر
        <input
          className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm"
          value={city}
          onChange={(event) => onCity(event.target.value)}
        />
      </label>
    </div>
  );
}

export function RecipientPreviewPanel({
  sources,
  text,
  messageClass,
}: {
  sources: string[];
  text: string;
  messageClass: string;
}) {
  const [status, setStatus] = useState('مخاطبی انتخاب نشده');
  useEffect(() => {
    if (!sources.length) {
      setStatus('مخاطبی انتخاب نشده');
      return;
    }
    const timer = window.setTimeout(() => {
      apiClient
        .post<{ final?: number; unitPricePerPart?: number | null }>('/admin/sms/segments/preview', {
          sources,
          text,
          messageClass,
          rules: [],
        })
        .then((row) => {
          const price = priceCaption(row.unitPricePerPart ?? null);
          setStatus(
            `${(row.final || 0).toLocaleString('fa-IR')} گیرنده نهایی${price ? ` · ${price}` : ''}`,
          );
        })
        .catch(() => setStatus('پیش‌نمایش در دسترس نیست'));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [sources, text, messageClass]);
  return (
    <p role="status" aria-live="polite" className="text-sm text-gray-700">
      {status}
    </p>
  );
}

export function ScheduleField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      زمان ارسال (۰۸ تا ۲۱ تهران)
      <input
        type="datetime-local"
        className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function ConfirmDialog({
  count,
  typedCount,
  otp,
  busy,
  onTypedCount,
  onOtp,
  onCancel,
  onConfirm,
}: {
  count: number;
  typedCount: string;
  otp: string;
  busy: boolean;
  onTypedCount: (value: string) => void;
  onOtp: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const typedOk = normalizeTypedCount(typedCount) === count;
  return (
    <div role="alertdialog" aria-modal="true" className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-bold text-red-900">
        برای تأیید، تعداد گیرندگان ({count.toLocaleString('fa-IR')}) را تایپ کنید
      </p>
      <input
        className="mt-2 w-full min-w-0 rounded-lg border px-3 py-2 ltr text-left"
        value={typedCount}
        onChange={(event) => onTypedCount(event.target.value)}
      />
      <input
        className="mt-2 w-full min-w-0 rounded-lg border px-3 py-2 ltr text-left"
        placeholder="کد OTP ادمین"
        value={otp}
        onChange={(event) => onOtp(event.target.value)}
      />
      <div className="sms-wizard-bar mt-3 flex gap-2">
        <button
          type="button"
          autoFocus
          className="min-h-11 rounded-lg border bg-white px-4 text-sm font-bold"
          onClick={onCancel}
        >
          انصراف
        </button>
        <button
          type="button"
          disabled={busy || !typedOk || otp.replace(/\D/g, '').length < 4}
          className="min-h-11 rounded-lg bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-50"
          onClick={onConfirm}
        >
          ارسال برای {count.toLocaleString('fa-IR')} نفر
        </button>
      </div>
    </div>
  );
}

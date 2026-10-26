'use client';

import React from 'react';
import { countSmsParts } from './sms-parts';

export function SmsClassBadge({ messageClass }: { messageClass: string }) {
  const map: Record<string, { label: string; className: string }> = {
    OTP: { label: 'رمز یکبار مصرف', className: 'bg-[#e8efff] text-[#1d4ed8]' },
    TRANSACTIONAL: { label: 'خدماتی', className: 'bg-[#e7f6ec] text-[#15803d]' },
    PROMO: { label: 'تبلیغاتی', className: 'bg-[#fff1e0] text-[#b45309]' },
  };
  const row = map[messageClass] || { label: messageClass, className: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${row.className}`}>
      {row.label}
    </span>
  );
}

export function SmsStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    QUEUED: 'در صف',
    SENDING: 'در حال ارسال',
    SENT: 'ارسال‌شده',
    DELIVERED: 'تحویل',
    UNDELIVERED: 'عدم تحویل',
    FAILED: 'ناموفق',
    SKIPPED: 'ردشده',
    PENDING_UNKNOWN: 'نامشخص',
    CANCELLED: 'لغوشده',
  };
  const dashed = status === 'PENDING_UNKNOWN';
  const strike = status === 'CANCELLED';
  return (
    <span
      aria-label={`وضعیت: ${labels[status] || status}`}
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
        dashed ? 'border-dashed border-gray-400 text-gray-600' : 'border-transparent bg-gray-100 text-gray-800'
      } ${strike ? 'line-through' : ''}`}
    >
      {labels[status] || status}
    </span>
  );
}

export function CreditCard({
  amount,
  threshold = 500,
  loading,
  error,
  onRetry,
}: {
  amount: number | null;
  threshold?: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <div className="h-16 animate-pulse rounded-xl bg-gray-100" aria-busy="true" />
    );
  }
  if (error || amount == null) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
        اعتبار: نامشخص{' '}
        {onRetry && (
          <button type="button" className="mr-2 underline" onClick={onRetry}>
            تلاش مجدد
          </button>
        )}
      </div>
    );
  }
  const tone =
    amount <= 0
      ? 'border-red-300 bg-red-50 text-red-900'
      : amount < threshold
        ? 'border-amber-300 bg-amber-50 text-amber-950'
        : 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${tone}`}>
      اعتبار: {amount.toLocaleString('fa-IR')} پیامک
    </div>
  );
}

export function PhonePreview({ body, messageClass }: { body: string; messageClass: string }) {
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-[28px] border-4 border-gray-800 bg-white p-3 shadow-sm">
      <div className="mb-2 text-center text-[11px] text-gray-400">پیش‌نمایش</div>
      <div className="rounded-2xl bg-gray-100 p-3 text-sm leading-7 text-gray-900 whitespace-pre-wrap">
        {body || '…'}
      </div>
      {messageClass !== 'OTP' && (
        <div className="mt-2 text-xs text-amber-800">🔒 لغو11 (قفل‌شده)</div>
      )}
    </div>
  );
}

export function PartsCounter({ body }: { body: string }) {
  const n = String(body || '').length;
  const parts = countSmsParts(body);
  return (
    <div className="text-xs text-gray-600" aria-live="polite">
      {n.toLocaleString('fa-IR')} نویسه · {parts.toLocaleString('fa-IR')} پارت
    </div>
  );
}

export function SmsSection({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-gray-900 sm:text-lg">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

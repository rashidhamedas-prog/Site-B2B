'use client';

import type { ReactNode } from 'react';
import { SpButton, spFocusClass } from '@/components/sales-partners/SpUi';

export function SpReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  minLength = 0,
  requireReason = true,
  reason,
  onReason,
  extra,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  minLength?: number;
  requireReason?: boolean;
  reason: string;
  onReason: (value: string) => void;
  extra?: ReactNode;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  const tooShort = requireReason && reason.trim().length < minLength;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" dir="rtl">
      <button type="button" className="absolute inset-0 bg-stone-900/40" aria-label="بستن" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-4 shadow-xl">
        <h2 className="text-base font-semibold text-stone-900">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-7 text-stone-600">{description}</p> : null}
        {extra}
        {requireReason ? (
          <label className="mt-3 block text-sm text-stone-700">
            دلیل
            <textarea
              className={`mt-1 min-h-24 w-full rounded-xl border border-stone-300 p-3 text-sm ${spFocusClass}`}
              value={reason}
              onChange={(e) => onReason(e.target.value)}
              maxLength={500}
            />
            <span className="mt-1 block text-xs text-stone-500">
              {reason.trim().length.toLocaleString('fa-IR')}
              {minLength > 0 ? ` / حداقل ${minLength.toLocaleString('fa-IR')} حرف` : ''}
            </span>
          </label>
        ) : null}
        {error ? (
          <p className="mt-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <SpButton variant="secondary" onClick={onClose} disabled={busy}>
            انصراف
          </SpButton>
          <SpButton
            variant={destructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            disabled={busy || tooShort}
          >
            {busy ? 'در حال ثبت…' : confirmLabel}
          </SpButton>
        </div>
      </div>
    </div>
  );
}

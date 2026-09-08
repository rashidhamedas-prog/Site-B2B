'use client';

import { Lock, ShieldCheck } from 'lucide-react';
import type { CheckoutAppearance } from '@/lib/checkout-payment-ui';
import { cn } from '@/lib/cn';

export function CheckoutPlaceOrderBar({
  appearance,
  label,
  hint,
  busy,
  disabled,
  onClick,
  sticky = false,
  amountLabel,
}: {
  appearance: CheckoutAppearance;
  label: string;
  hint: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  sticky?: boolean;
  amountLabel?: string;
}) {
  const retail = appearance === 'retail';

  return (
    <div
      className={cn(
        sticky &&
          'fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden',
        sticky && (retail
          ? 'border-[var(--retail-border)] bg-[var(--retail-surface)]/95 backdrop-blur-md'
          : 'border-gray-200 bg-white/95 backdrop-blur-md'),
      )}
    >
      {amountLabel && sticky ? (
        <p className={cn('mb-2 text-center text-xs', retail ? 'text-[var(--retail-muted)]' : 'text-gray-500')}>
          قابل پرداخت: <span className={cn('font-extrabold', retail ? 'text-[var(--retail-ink)]' : 'text-gray-900')}>{amountLabel}</span>
        </p>
      ) : null}
      <button
        type="button"
        disabled={disabled || busy}
        onClick={onClick}
        className={cn(
          'flex w-full min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-extrabold text-white transition-opacity duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          retail
            ? 'bg-[var(--retail-gold)] focus-visible:ring-[var(--retail-gold)] hover:opacity-95'
            : 'bg-primary focus-visible:ring-primary hover:bg-primary-light',
        )}
      >
        {busy ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
        ) : null}
        <span>{label}</span>
      </button>
      <p className={cn('mt-2 flex items-start justify-center gap-1.5 text-center text-[11px] leading-5', retail ? 'text-[var(--retail-muted)]' : 'text-gray-400')}>
        <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span>{hint}</span>
      </p>
      {!sticky ? (
        <p className={cn('mt-1 flex items-center justify-center gap-1.5 text-[11px]', retail ? 'text-[var(--retail-primary)]' : 'text-primary')}>
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          پرداخت و موجودی روی سرور محاسبه می‌شود
        </p>
      ) : null}
    </div>
  );
}

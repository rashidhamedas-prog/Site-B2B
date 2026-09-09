'use client';

import type { KeyboardEvent } from 'react';
import { Banknote, CalendarClock, CreditCard, Truck, Wallet } from 'lucide-react';
import { PaymentBrandLogo } from '@/components/checkout/PaymentBrandLogo';
import {
  CHECKOUT_PAYMENT_INTRO,
  type CheckoutAppearance,
  type CheckoutChoiceOption,
  type CheckoutPaymentIcon,
} from '@/lib/checkout-payment-ui';
import { cn } from '@/lib/cn';

const ICONS: Record<CheckoutPaymentIcon, typeof CreditCard> = {
  card: CreditCard,
  wallet: Wallet,
  cash: Banknote,
  installment: CalendarClock,
  truck: Truck,
};

function onArrowKey(
  event: KeyboardEvent<HTMLDivElement>,
  options: CheckoutChoiceOption[],
  value: string,
  onChange: (id: string) => void,
) {
  const enabled = options.filter((o) => !o.disabled);
  if (enabled.length === 0) return;
  const current = Math.max(0, enabled.findIndex((o) => o.id === value));
  let next = current;
  if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') next = (current + 1) % enabled.length;
  else if (event.key === 'ArrowUp' || event.key === 'ArrowRight') next = (current - 1 + enabled.length) % enabled.length;
  else return;
  event.preventDefault();
  onChange(enabled[next]!.id);
}

export function CheckoutChoiceList({
  appearance,
  legend,
  options,
  value,
  onChange,
  name,
}: {
  appearance: CheckoutAppearance;
  legend: string;
  options: CheckoutChoiceOption[];
  value: string;
  onChange: (id: string) => void;
  name: string;
}) {
  const retail = appearance === 'retail';
  const isPayment = legend === 'روش پرداخت';
  const introId = `${name}-help`;

  return (
    <div className="space-y-3">
      {isPayment ? (
        <p id={introId} className={cn('text-[13px] leading-7', retail ? 'text-[var(--retail-muted)]' : 'text-gray-600')}>
          {CHECKOUT_PAYMENT_INTRO}
        </p>
      ) : null}
      <div
        role="radiogroup"
        aria-label={legend}
        aria-describedby={isPayment ? introId : undefined}
        onKeyDown={(e) => onArrowKey(e, options, value, onChange)}
        className="space-y-2.5"
      >
        {options.map((option) => {
          const selected = option.id === value;
          const Icon = ICONS[option.icon];
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              name={name}
              aria-checked={selected}
              aria-disabled={option.disabled || undefined}
              tabIndex={selected || (!value && option.id === options[0]?.id) ? 0 : -1}
              disabled={option.disabled}
              onClick={() => {
                if (!option.disabled) onChange(option.id);
              }}
              className={cn(
                'relative flex w-full min-h-[3.5rem] cursor-pointer flex-row-reverse items-start gap-3 rounded-2xl border px-3.5 py-3.5 text-right transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                retail
                  ? 'focus-visible:ring-[var(--retail-gold)]'
                  : 'focus-visible:ring-secondary',
                option.disabled && 'cursor-not-allowed opacity-55',
                selected
                  ? retail
                    ? 'border-[var(--retail-gold)] bg-white shadow-[0_10px_28px_rgba(27,92,74,0.08)]'
                    : 'border-secondary bg-white shadow-[0_10px_28px_rgba(27,92,74,0.08)]'
                  : retail
                    ? 'border-[var(--retail-border)] bg-[var(--retail-card)]/40 hover:border-[var(--retail-gold)]/50'
                    : 'border-gray-200 bg-[var(--brand-ivory,#F6F1E8)]/40 hover:border-secondary/50',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
                  option.logo || !selected
                    ? 'bg-white'
                    : retail
                      ? 'bg-[var(--retail-primary)] text-[var(--retail-gold-light,#E5C97C)]'
                      : 'bg-primary text-secondary',
                  option.logo
                    ? selected
                      ? retail
                        ? 'ring-2 ring-[var(--retail-gold)]'
                        : 'ring-2 ring-secondary'
                      : retail
                        ? 'ring-1 ring-[var(--retail-border)]'
                        : 'ring-1 ring-gray-200'
                    : selected
                      ? null
                      : retail
                        ? 'text-[var(--retail-primary)] ring-1 ring-[var(--retail-border)]'
                        : 'text-primary ring-1 ring-gray-200',
                )}
                aria-hidden
              >
                {option.logo ? <PaymentBrandLogo logo={option.logo} /> : <Icon className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={cn('text-sm font-extrabold', retail ? 'text-[var(--retail-ink)]' : 'text-gray-900')}>
                    {option.title}
                  </span>
                  {option.badge ? (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold',
                        retail
                          ? 'bg-[var(--retail-gold)]/15 text-[var(--retail-primary-dark)]'
                          : 'bg-secondary/15 text-primary-dark',
                      )}
                    >
                      {option.badge}
                    </span>
                  ) : null}
                </span>
                <span className={cn('mt-1 block text-[13px] leading-7', retail ? 'text-[var(--retail-muted)]' : 'text-gray-600')}>
                  {option.description}
                </span>
                {option.hint && selected ? (
                  <span className={cn('mt-1 block text-[12px] font-medium leading-6', retail ? 'text-[var(--retail-primary)]' : 'text-primary')}>
                    {option.hint}
                  </span>
                ) : null}
                {option.disabled && option.disabledReason ? (
                  <span className="mt-1 block text-[11px] text-amber-800">{option.disabledReason}</span>
                ) : null}
              </span>
              <span
                className={cn(
                  'mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                  selected
                    ? retail
                      ? 'border-[var(--retail-gold)] bg-[var(--retail-gold)]'
                      : 'border-secondary bg-secondary'
                    : retail
                      ? 'border-[var(--retail-border)] bg-white'
                      : 'border-gray-300 bg-white',
                )}
                aria-hidden
              >
                {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

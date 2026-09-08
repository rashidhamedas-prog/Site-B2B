import type { ReactNode } from 'react';
import type { CheckoutAppearance } from '@/lib/checkout-payment-ui';
import { cn } from '@/lib/cn';

const chrome = {
  retail: {
    panel: 'rounded-[1.6rem] bg-[var(--retail-surface,#fff)] p-5 ring-1 ring-[var(--retail-border)] sm:p-6',
    index: 'text-[var(--retail-gold)]',
    title: 'text-[var(--retail-ink)]',
    muted: 'text-[var(--retail-muted)]',
    rule: 'bg-gradient-to-l from-transparent via-[var(--retail-gold)] to-transparent',
  },
  wholesale: {
    panel: 'rounded-[1.6rem] bg-white p-5 ring-1 ring-black/5 shadow-[0_8px_28px_rgba(27,92,74,0.06)] sm:p-6',
    index: 'text-secondary',
    title: 'text-gray-900',
    muted: 'text-gray-500',
    rule: 'bg-gradient-to-l from-transparent via-[var(--brand-gold,#C9A84C)] to-transparent',
  },
} as const;

export function CheckoutPanel({
  appearance,
  id,
  index,
  title,
  subtitle,
  children,
  className,
}: {
  appearance: CheckoutAppearance;
  id?: string;
  index: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  const t = chrome[appearance];
  return (
    <section id={id} className={cn(t.panel, className)}>
      <header className="mb-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className={cn('text-[11px] font-bold tracking-[0.22em]', t.index)}>{index}</p>
            <h2 className={cn('mt-1 text-lg font-extrabold', t.title)}>{title}</h2>
            {subtitle ? <p className={cn('mt-1 text-sm', t.muted)}>{subtitle}</p> : null}
          </div>
        </div>
        <div className={cn('mt-4 h-px w-16', t.rule)} aria-hidden />
      </header>
      {children}
    </section>
  );
}

const STEPS = [
  { id: 'checkout-address', label: 'آدرس' },
  { id: 'checkout-shipping', label: 'ارسال' },
  { id: 'checkout-payment', label: 'پرداخت' },
] as const;

export function CheckoutStepRail({
  appearance,
  steps = STEPS,
}: {
  appearance: CheckoutAppearance;
  steps?: ReadonlyArray<{ id: string; label: string }>;
}) {
  const ink = appearance === 'retail'
    ? 'text-[var(--retail-primary)]'
    : 'text-primary';
  const line = appearance === 'retail'
    ? 'bg-[var(--retail-border)]'
    : 'bg-gray-200';

  return (
    <nav aria-label="مراحل تسویه" className="mt-6 flex items-center gap-2 text-xs font-bold sm:gap-3">
      {steps.map((step, i) => (
        <span key={step.id} className="flex min-w-0 items-center gap-2 sm:gap-3">
          {i > 0 ? <span className={cn('h-px w-6 sm:w-10', line)} aria-hidden /> : null}
          <a href={`#${step.id}`} className={cn('truncate hover:underline', ink)}>
            {step.label}
          </a>
        </span>
      ))}
    </nav>
  );
}

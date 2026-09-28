'use client';

import { cn } from '@/lib/cn';

type Props = {
  secondsLeft: number;
  onResend: () => void;
  busy?: boolean;
  className?: string;
  idleLabel?: string;
};

/**
 * Controlled resend control — parent owns useSmsResendCooldown and starts timer from API.
 */
export function SmsResendButton({
  secondsLeft,
  onResend,
  busy = false,
  className,
  idleLabel = 'ارسال دوباره پیامک',
}: Props) {
  const waiting = secondsLeft > 0;
  const disabled = busy || waiting;
  const label = busy
    ? 'در حال ارسال…'
    : waiting
      ? `ارسال دوباره تا ${secondsLeft} ثانیه دیگر`
      : idleLabel;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onResend}
      className={cn(
        'mx-auto block min-h-11 text-sm font-semibold text-[var(--color-primary)] underline-offset-2',
        'transition-opacity duration-200',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
        disabled
          ? 'cursor-not-allowed text-[var(--brand-muted)] no-underline opacity-80'
          : 'hover:underline',
        className,
      )}
    >
      <span aria-live="polite">{label}</span>
    </button>
  );
}

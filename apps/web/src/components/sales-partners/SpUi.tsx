'use client';

import {
  type ButtonHTMLAttributes,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { RefreshCw } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { spStatusTone } from './sp-labels';

export const spFocusClass =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C]';

export function spChipClass(active: boolean) {
  return cn(
    'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm transition-colors duration-200',
    spFocusClass,
    'disabled:opacity-40',
    active ? 'bg-[#1B5C4A] text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:ring-[#1B5C4A]/30',
  );
}

const TONE: Record<ReturnType<typeof spStatusTone>, string> = {
  ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warn: 'bg-amber-50 text-amber-900 border-amber-200',
  danger: 'bg-red-50 text-red-800 border-red-200',
  info: 'bg-sky-50 text-sky-800 border-sky-200',
  neutral: 'bg-stone-100 text-stone-700 border-stone-200',
};

type SpButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

const BUTTON_VARIANTS: Record<SpButtonVariant, string> = {
  primary:
    'bg-[#1B5C4A] text-white shadow-sm shadow-[#1B5C4A]/15 hover:bg-[#164c3d] active:scale-[0.98]',
  secondary:
    'border border-stone-300 bg-white text-stone-800 hover:border-[#1B5C4A]/40 hover:bg-[#1B5C4A]/5 active:scale-[0.98]',
  ghost: 'bg-transparent text-stone-700 hover:bg-white/70 active:scale-[0.98]',
  destructive:
    'border border-red-200 bg-red-50 text-red-800 hover:bg-red-100 active:scale-[0.98]',
};

export function SpButton({
  variant = 'primary',
  className,
  children,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: SpButtonVariant }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100',
        BUTTON_VARIANTS[variant],
        spFocusClass,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SpBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONE[spStatusTone(status)]}`}
    >
      {label}
    </span>
  );
}

export function SpKpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={cn(
        'min-w-0 rounded-2xl border p-4',
        accent ? 'border-[#1B5C4A]/30 bg-[#1B5C4A]/5' : 'border-stone-200 bg-white',
      )}
    >
      <p className={cn('text-xs', accent ? 'text-[#1B5C4A]' : 'text-stone-500')}>{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tabular-nums tracking-tight text-stone-900">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-5 text-stone-500">{hint}</p> : null}
    </motion.div>
  );
}

export function SpSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SpEmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 p-6 text-sm leading-7 text-stone-600',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SpBarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-stone-600">
        <span className="truncate">{label}</span>
        <span className="shrink-0 tabular-nums">{value.toLocaleString('fa-IR')}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-100" role="presentation">
        <div
          className="h-full rounded-full bg-[#1B5C4A] transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SpRefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <SpButton variant="secondary" aria-label="تازه‌سازی داده‌ها" onClick={onClick} disabled={busy}>
      <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} aria-hidden />
      تازه‌سازی
    </SpButton>
  );
}

export function SpSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-2xl bg-stone-200/80 motion-reduce:animate-none', className)}
      aria-hidden
    />
  );
}

export function SpPageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="mt-5 space-y-3" role="status" aria-label="در حال بارگذاری">
      <SpSkeleton className="h-24 w-full" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: Math.min(cards, 3) }).map((_, i) => (
          <SpSkeleton key={i} className="h-20" />
        ))}
      </div>
      <SpSkeleton className="h-40 w-full" />
      <span className="sr-only">در حال بارگذاری…</span>
    </div>
  );
}

export function SpStepRail({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="mb-5 flex items-center gap-2" aria-label="مراحل">
      {steps.map((label, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <li key={label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-200',
                done || active ? 'bg-[#1B5C4A] text-white' : 'bg-white text-stone-500 border border-stone-200',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {(index + 1).toLocaleString('fa-IR')}
            </span>
            <span className={cn('truncate text-[11px]', active ? 'font-medium text-stone-900' : 'text-stone-500')}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type ToastCtx = { show: (message: string) => void };

const SpToastContext = createContext<ToastCtx | null>(null);

export function SpToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((next: string) => {
    setMessage(next);
  }, []);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(null), 2200);
    return () => window.clearTimeout(id);
  }, [message]);

  return (
    <SpToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4" aria-live="polite">
        {message ? (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-2xl bg-[#0F2F28] px-4 py-2.5 text-sm text-white shadow-lg"
            role="status"
          >
            {message}
          </motion.p>
        ) : null}
      </div>
    </SpToastContext.Provider>
  );
}

export function useSpToast() {
  const ctx = useContext(SpToastContext);
  return ctx ?? { show: () => undefined };
}

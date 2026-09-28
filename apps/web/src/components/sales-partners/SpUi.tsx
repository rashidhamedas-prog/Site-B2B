'use client';

import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { spStatusTone } from './sp-labels';

const focus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C]';

const TONE: Record<ReturnType<typeof spStatusTone>, string> = {
  ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warn: 'bg-amber-50 text-amber-900 border-amber-200',
  danger: 'bg-red-50 text-red-800 border-red-200',
  info: 'bg-sky-50 text-sky-800 border-sky-200',
  neutral: 'bg-stone-100 text-stone-700 border-stone-200',
};

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
  return (
    <div
      className={`min-w-0 rounded-2xl border p-4 ${
        accent ? 'border-[#1B5C4A]/30 bg-[#1B5C4A]/5' : 'border-stone-200 bg-white'
      }`}
    >
      <p className={`text-xs ${accent ? 'text-[#1B5C4A]' : 'text-stone-500'}`}>{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tabular-nums tracking-tight text-stone-900">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-5 text-stone-500">{hint}</p> : null}
    </div>
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

export function SpEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 p-6 text-sm leading-7 text-stone-600">
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
    <button
      type="button"
      aria-label="تازه‌سازی داده‌ها"
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 ${focus}`}
      onClick={onClick}
      disabled={busy}
    >
      <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden />
      تازه‌سازی
    </button>
  );
}

export { focus as spFocusClass };

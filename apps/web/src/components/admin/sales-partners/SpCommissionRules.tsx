'use client';

import { FormEvent } from 'react';
import { toman } from '@/lib/product-display';
import { SpBadge, SpEmptyState, SpSection, spFocusClass } from '@/components/sales-partners/SpUi';
import { formatSpDate } from '@/components/sales-partners/sp-labels';
import {
  COMMISSION_SCOPE_FA,
  activeProgramRule,
  commissionDeskCounts,
  productCommissionFollowsProgram,
  samplePartnerCommissionIrr,
} from './sp-admin-ops';
import type { RuleRow } from './types';

type Props = {
  rules: RuleRow[];
  percent: number;
  note: string;
  propagate: boolean;
  busy: boolean;
  message: string | null;
  onPercent: (value: number) => void;
  onNote: (value: string) => void;
  onPropagate: (value: boolean) => void;
  onSubmit: () => void;
};

export function SpCommissionRules({
  rules,
  percent,
  note,
  propagate,
  busy,
  message,
  onPercent,
  onNote,
  onPropagate,
  onSubmit,
}: Props) {
  const program = activeProgramRule(rules);
  const counts = commissionDeskCounts(rules);
  const active = rules.filter((row) => row.active);
  const inactive = rules.filter((row) => !row.active);
  const sampleIrr = samplePartnerCommissionIrr(1_000_000, Number.isInteger(percent) ? percent : 0);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <SpSection
      title="تعیین پورسانت"
      description="نرخ برنامه برای سفارش‌های بعدی است. نرخ اختصاصی هر کالا جدا می‌ماند."
    >
      <form className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4" onSubmit={submit}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-stone-500">نرخ فعال برنامه</p>
            <p className="text-3xl font-semibold tabular-nums text-stone-900">
              {program ? `${program.percent.toLocaleString('fa-IR')}٪` : 'ثبت نشده'}
            </p>
          </div>
          <p className="max-w-sm text-sm leading-6 text-stone-600">
            اولویت محاسبه: نرخ اختصاصی همکار، بعد نرخ محصول، بعد دسته، بعد این نرخ برنامه.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="محصولات پیرو" value={counts.followers.toLocaleString('fa-IR')} />
          <Stat label="نرخ اختصاصی" value={counts.overrides.toLocaleString('fa-IR')} />
          <Stat label="از هر ۱۰۰ هزار تومان" value={`${toman(sampleIrr)} تومان`} />
        </div>

        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <label className="block text-sm" htmlFor="sp-rule-percent">
            درصد جدید
            <input
              id="sp-rule-percent"
              type="number"
              min={0}
              max={80}
              step={1}
              inputMode="numeric"
              dir="ltr"
              value={percent}
              onChange={(e) => onPercent(Number(e.target.value))}
              className={`mt-1 min-h-11 w-full rounded-xl border px-3 tabular-nums ${spFocusClass}`}
            />
          </label>
          <label className="block text-sm" htmlFor="sp-rule-note">
            توضیح داخلی
            <input
              id="sp-rule-note"
              value={note}
              maxLength={240}
              onChange={(e) => onNote(e.target.value)}
              className={`mt-1 min-h-11 w-full rounded-xl border px-3 ${spFocusClass}`}
            />
          </label>
        </div>

        <label className="flex items-start gap-2 text-sm leading-6 text-stone-700" htmlFor="sp-rule-propagate">
          <input
            id="sp-rule-propagate"
            type="checkbox"
            className="mt-1"
            checked={propagate}
            onChange={(e) => onPropagate(e.target.checked)}
          />
          <span>این درصد را روی محصولات پیرو هم اعمال کن. نرخ‌های اختصاصی و سفارش‌های قبلی عوض نمی‌شوند.</span>
        </label>

        {message ? (
          <p className="rounded-xl bg-[#1B5C4A]/10 px-3 py-2 text-sm text-[#1B5C4A]" role="status">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          className={`min-h-11 rounded-xl bg-[#1B5C4A] px-4 text-white ${spFocusClass}`}
          disabled={busy}
        >
          {busy ? 'در حال ذخیره…' : 'ذخیره نرخ برنامه'}
        </button>
      </form>

      {active.length === 0 ? (
        <SpEmptyState>قانون فعالی نیست؛ تا ثبت نرخ، پورسانت تخمینی صفر است.</SpEmptyState>
      ) : (
        <ul className="space-y-2">
          {active.map((row) => (
            <RuleLine key={row.id} row={row} />
          ))}
        </ul>
      )}

      {inactive.length > 0 ? (
        <details className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">نرخ‌های قبلی ({inactive.length.toLocaleString('fa-IR')})</summary>
          <ul className="mt-3 space-y-2">
            {inactive.map((row) => (
              <RuleLine key={row.id} row={row} />
            ))}
          </ul>
        </details>
      ) : null}
    </SpSection>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 font-medium tabular-nums text-stone-900">{value}</p>
    </div>
  );
}

function RuleLine({ row }: { row: RuleRow }) {
  const follows = row.scope === 'PRODUCT' && productCommissionFollowsProgram(row.note);
  const override = row.scope === 'PRODUCT' && !follows;
  return (
    <li className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">
          {COMMISSION_SCOPE_FA[row.scope] || row.scope} · {row.percent.toLocaleString('fa-IR')}٪
        </p>
        <SpBadge status={row.active ? 'ACTIVE' : 'OFF'} label={row.active ? 'فعال' : 'غیرفعال'} />
        {follows ? <span className="text-xs text-stone-500">پیرو برنامه</span> : null}
        {override ? <span className="text-xs text-amber-800">اختصاصی</span> : null}
      </div>
      {row.note && !row.note.startsWith('override:') ? <p className="mt-1 text-stone-600">{row.note}</p> : null}
      {row.createdAt ? <p className="mt-1 text-xs text-stone-400">{formatSpDate(row.createdAt)}</p> : null}
    </li>
  );
}

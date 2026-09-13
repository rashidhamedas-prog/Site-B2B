'use client';

import { Plus, Trash2 } from 'lucide-react';
import { NumberField } from './fields';
import { SettingsSection } from './primitives';
import type { SettingsPayload } from './types';

export function InstallmentsTab({
  data,
  categories,
  onChange,
}: {
  data: SettingsPayload;
  categories: Array<{ id: string; name: string }>;
  onChange: (next: SettingsPayload) => void;
}) {
  const inst = data.installments;
  const set = (patch: Partial<SettingsPayload['installments']>) =>
    onChange({ ...data, installments: { ...inst, ...patch } });

  return (
    <SettingsSection title="قوانین پرداخت اقساطی" hint="اقساط فقط برای مشتریان با حداقل فاکتور فعال زیر.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          label="حداقل فاکتور فعال"
          value={inst.minActiveInvoices ?? 2}
          onChange={(v) => set({ minActiveInvoices: Math.max(1, v) })}
          help="کمتر از این عدد، اقساط در چک‌اوت دیده نمی‌شود"
        />
        <NumberField
          label="کف پیش‌پرداخت مبلغی (تومان)"
          value={inst.minDownPaymentAmount ?? 0}
          onChange={(v) => set({ minDownPaymentAmount: Math.max(0, v) })}
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className="btn btn-outline btn-sm inline-flex items-center gap-1.5"
          onClick={() => set({
            rules: [...(inst.rules ?? []), { id: `rule_${Date.now()}`, minDownPaymentPercent: 30, maxMonths: 6, categoryId: null }],
          })}
        >
          <Plus className="h-3.5 w-3.5" /> افزودن قانون
        </button>
      </div>
      {(inst.rules ?? []).map((rule) => (
        <div key={rule.id} className="grid grid-cols-1 items-end gap-3 rounded-2xl border border-gray-100 p-4 sm:grid-cols-4">
          <NumberField
            label="حداقل پیش‌پرداخت (%)"
            value={rule.minDownPaymentPercent}
            onChange={(v) => set({ rules: inst.rules.map((r) => r.id === rule.id ? { ...r, minDownPaymentPercent: v } : r) })}
          />
          <NumberField
            label="حداکثر اقساط (ماه)"
            value={rule.maxMonths}
            onChange={(v) => set({ rules: inst.rules.map((r) => r.id === rule.id ? { ...r, maxMonths: Math.max(1, v) } : r) })}
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor={`inst-cat-${rule.id}`}>دسته‌بندی</label>
            <select
              id={`inst-cat-${rule.id}`}
              value={rule.categoryId ?? ''}
              onChange={(e) => set({ rules: inst.rules.map((r) => r.id === rule.id ? { ...r, categoryId: e.target.value || null } : r) })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">همه</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm text-error inline-flex items-center gap-1"
            disabled={(inst.rules?.length ?? 0) <= 1}
            onClick={() => set({ rules: inst.rules.filter((r) => r.id !== rule.id) })}
          >
            <Trash2 className="h-3.5 w-3.5" /> حذف
          </button>
        </div>
      ))}
    </SettingsSection>
  );
}

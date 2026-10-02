'use client';

import type { ApplyFormField, ApplyFormFieldType } from './types';
import { spFocusClass } from '@/components/sales-partners/SpUi';

type Props = {
  fields: ApplyFormField[];
  onChange: (next: ApplyFormField[]) => void;
};

const TYPE_LABEL: Record<ApplyFormFieldType, string> = {
  text: 'متن',
  textarea: 'چندخطی',
  select: 'انتخابی',
  phone: 'موبایل',
  national_id: 'کد ملی',
  checkbox: 'چک‌باکس',
};

function sortFields(fields: ApplyFormField[]) {
  return [...fields].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
}

export function SpApplyFormBuilder({ fields, onChange }: Props) {
  const sorted = sortFields(fields);

  function update(key: string, patch: Partial<ApplyFormField>) {
    onChange(
      fields.map((f) => {
        if (f.key !== key) return f;
        if (f.locked) {
          return { ...f, label: patch.label ?? f.label, order: patch.order ?? f.order };
        }
        return { ...f, ...patch };
      }),
    );
  }

  function move(key: string, dir: -1 | 1) {
    const ordered = sortFields(fields);
    const idx = ordered.findIndex((f) => f.key === key);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[swap];
    const nextOrderA = b.order;
    const nextOrderB = a.order;
    onChange(
      fields.map((f) => {
        if (f.key === a.key) return { ...f, order: nextOrderA };
        if (f.key === b.key) return { ...f, order: nextOrderB };
        return f;
      }),
    );
  }

  function addCustom() {
    const suffix = Math.random().toString(36).slice(2, 8);
    const key = `custom_${suffix}`;
    const maxOrder = fields.reduce((m, f) => Math.max(m, f.order), 0);
    onChange([
      ...fields,
      {
        key,
        enabled: true,
        required: false,
        label: 'فیلد سفارشی',
        order: maxOrder + 10,
        type: 'text',
        maxLength: 120,
      },
    ]);
  }

  function removeCustom(key: string) {
    if (!key.startsWith('custom_')) return;
    onChange(fields.filter((f) => f.key !== key));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">فیلدهای فرم ثبت‌نام</h3>
          <p className="mt-1 text-xs leading-5 text-stone-600">
            فیلدهای قفل‌شده (نام، موبایل، شرایط) همیشه فعال‌اند. بقیه را می‌توانید خاموش یا الزامی کنید.
          </p>
        </div>
        <button
          type="button"
          className={`min-h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm ${spFocusClass}`}
          onClick={addCustom}
        >
          افزودن فیلد
        </button>
      </div>

      <ul className="space-y-2">
        {sorted.map((field) => (
          <li key={field.key} className="rounded-2xl border border-stone-200 bg-white p-3">
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 font-mono text-[11px] text-stone-600">
                    {field.key}
                  </span>
                  <span className="text-[11px] text-stone-500">{TYPE_LABEL[field.type] || field.type}</span>
                  {field.locked ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900">قفل</span>
                  ) : null}
                </div>
                <label className="block text-xs text-stone-600" htmlFor={`sp-ff-label-${field.key}`}>
                  برچسب
                </label>
                <input
                  id={`sp-ff-label-${field.key}`}
                  className={`min-h-10 w-full rounded-xl border px-3 text-sm ${spFocusClass}`}
                  value={field.label}
                  onChange={(e) => update(field.key, { label: e.target.value })}
                />
                {!field.locked && field.type === 'select' ? (
                  <p className="text-[11px] text-stone-500">
                    گزینه‌ها: {(field.options || []).map((o) => o.label).join('، ') || '—'}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex min-h-9 items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={field.enabled}
                    disabled={field.locked}
                    onChange={(e) => update(field.key, { enabled: e.target.checked })}
                  />
                  نمایش
                </label>
                <label className="flex min-h-9 items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={field.required}
                    disabled={field.locked || !field.enabled}
                    onChange={(e) => update(field.key, { required: e.target.checked })}
                  />
                  الزامی
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`min-h-9 rounded-lg border px-2 text-xs ${spFocusClass}`}
                    onClick={() => move(field.key, -1)}
                    aria-label="بالاتر"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={`min-h-9 rounded-lg border px-2 text-xs ${spFocusClass}`}
                    onClick={() => move(field.key, 1)}
                    aria-label="پایین‌تر"
                  >
                    ↓
                  </button>
                </div>
                {field.key.startsWith('custom_') ? (
                  <button
                    type="button"
                    className={`min-h-9 rounded-lg border border-red-200 px-2 text-xs text-red-800 ${spFocusClass}`}
                    onClick={() => removeCustom(field.key)}
                  >
                    حذف
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

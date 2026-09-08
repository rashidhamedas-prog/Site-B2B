'use client';

import type { ReactNode } from 'react';
import { Eye, EyeOff, Loader2, Upload } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import {
  applyEnamadHtmlPaste,
  enamadLogoUrl,
  resolveMediaUrl,
  type EnamadSealConfig,
} from '@/lib/enamad';
import { EnamadSeal } from '@/components/shared/EnamadSeal';

export function TextField({
  label, value, onChange, icon, type = 'text', placeholder, dir = 'rtl', help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon?: ReactNode;
  type?: string;
  placeholder?: string;
  dir?: 'rtl' | 'ltr';
  help?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </span>
        ) : null}
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir={dir}
          className={cn(
            'w-full rounded-lg border border-gray-200 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30',
            icon ? 'px-3 pr-9' : 'px-3',
          )}
        />
      </div>
      {help ? <p className="mt-1 text-[11px] text-gray-400">{help}</p> : null}
    </div>
  );
}

export function NumberField({
  label, value, onChange, help, step, min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  help?: string;
  step?: string | number;
  min?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type="number"
        step={step}
        min={min}
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {help ? <p className="mt-1 text-[11px] text-gray-400">{help}</p> : null}
    </div>
  );
}

export function TextAreaField({
  label, value, onChange, rows = 2,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      {label ? <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label> : null}
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

export function SecretField({
  label, value, onChange, shown, onToggle, help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  shown: boolean;
  onToggle: () => void;
  help?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <div className="relative">
        <input
          type={shown ? 'text' : 'password'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          dir="ltr"
          placeholder="•••••••••••••"
          autoComplete="off"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 pl-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
          aria-label={shown ? 'مخفی کردن مقدار' : 'نمایش مقدار'}
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {help ? <p className="mt-1 text-[11px] text-gray-400">{help}</p> : null}
    </div>
  );
}

export function ToggleRow({
  label, hint, value, onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl p-3 transition-colors hover:bg-gray-50">
      <span>
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11px] text-gray-400">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          value ? 'bg-primary' : 'bg-gray-200',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            value ? 'right-0.5' : 'right-[calc(100%-1.375rem)]',
          )}
        />
      </button>
    </label>
  );
}

export function EnamadEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: EnamadSealConfig;
  onChange: (v: EnamadSealConfig) => void;
}) {
  const { upload, uploading } = useImageUpload();
  const preview =
    resolveMediaUrl(value.imageUrl) ||
    (value.id && value.code ? enamadLogoUrl(value.id, value.code) : '');
  const set = (patch: Partial<EnamadSealConfig>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-emerald-950">{title}</p>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-emerald-900">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
            className="rounded border-emerald-300"
          />
          نمایش در فوتر
        </label>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">کد HTML از پنل اینماد</label>
        <textarea
          value={value.htmlSnippet}
          onChange={(e) => onChange(applyEnamadHtmlPaste(value, e.target.value))}
          rows={4}
          dir="ltr"
          className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="شناسه اینماد (id)"
          value={value.id}
          onChange={(v) => set({ id: v.trim(), enabled: v.trim() || value.code ? true : value.enabled })}
          dir="ltr"
        />
        <TextField
          label="کد اینماد (Code)"
          value={value.code}
          onChange={(v) => set({ code: v.trim(), enabled: value.id || v.trim() ? true : value.enabled })}
          dir="ltr"
        />
      </div>
      <TextField label="لینک تأیید (اختیاری)" value={value.linkUrl} onChange={(v) => set({ linkUrl: v.trim() })} dir="ltr" />
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">تصویر نشان</label>
        <div className="flex flex-wrap items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-16 w-16 rounded-lg border border-emerald-200 bg-white object-contain p-1" referrerPolicy="origin" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-emerald-200 bg-white text-[10px] text-gray-400">
              بدون تصویر
            </div>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-50">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? 'در حال آپلود…' : 'آپلود تصویر نشان'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                const url = await upload(file);
                if (url) set({ imageUrl: url, enabled: true });
              }}
            />
          </label>
        </div>
        <input
          className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
          dir="ltr"
          value={value.imageUrl}
          onChange={(e) => set({ imageUrl: e.target.value.trim() })}
        />
      </div>
      <div className="rounded-lg border border-emerald-200/80 bg-white p-3">
        <p className="mb-2 text-[11px] font-medium text-gray-500">پیش‌نمایش فوتر</p>
        {value.enabled ? <EnamadSeal config={value} size={72} /> : <p className="text-xs text-gray-400">برای دیدن نشان، نمایش فوتر را روشن کنید.</p>}
      </div>
    </div>
  );
}

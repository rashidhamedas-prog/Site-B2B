'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { AdminChannelTabs, type AdminChannel } from '@/components/admin/AdminChannelTabs';

export function SettingsSection({
  title,
  hint,
  badge,
  tone = 'neutral',
  children,
}: {
  title: string;
  hint?: string;
  badge?: string;
  tone?: 'neutral' | 'retail' | 'wholesale';
  children: ReactNode;
}) {
  const ring =
    tone === 'retail'
      ? 'border-amber-100 bg-gradient-to-bl from-amber-50/80 to-white'
      : tone === 'wholesale'
        ? 'border-primary/15 bg-gradient-to-bl from-primary/5 to-white'
        : 'border-gray-100 bg-white';
  return (
    <section className={cn('space-y-4 rounded-2xl border p-5 shadow-sm', ring)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          {hint ? <p className="mt-1 text-xs leading-6 text-gray-500">{hint}</p> : null}
        </div>
        {badge ? (
          <span className="rounded-full bg-gray-900/5 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
            {badge}
          </span>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function ChannelScope({
  value,
  onChange,
  children,
}: {
  value: AdminChannel;
  onChange: (v: AdminChannel) => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-500">این تنظیمات فقط برای سایت انتخاب‌شده ذخیره می‌شود</p>
        <AdminChannelTabs value={value} onChange={onChange} />
      </div>
      {children}
    </div>
  );
}

export function LiveStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  );
}

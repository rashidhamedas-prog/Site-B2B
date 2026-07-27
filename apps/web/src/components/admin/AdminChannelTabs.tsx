'use client';

import { cn } from '@/lib/cn';

export type AdminChannel = 'WHOLESALE' | 'RETAIL';

const OPTIONS: { id: AdminChannel; label: string; hint: string }[] = [
  { id: 'WHOLESALE', label: 'سایت عمده', hint: 'poshaktaranom.com' },
  { id: 'RETAIL', label: 'سایت تکی', hint: 'poshaktaranom.ir' },
];

interface AdminChannelTabsProps {
  value: AdminChannel;
  onChange: (channel: AdminChannel) => void;
  className?: string;
}

export function AdminChannelTabs({
  value,
  onChange,
  className,
}: AdminChannelTabsProps) {
  return (
    <div
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1',
        className,
      )}
      role="tablist"
      aria-label="انتخاب کانال فروش"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              'cursor-pointer rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200',
              active
                ? opt.id === 'RETAIL'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-white hover:text-gray-900',
            )}
          >
            <span className="block leading-tight">{opt.label}</span>
            <span className={cn('block text-[10px] font-normal', active ? 'text-white/80' : 'text-gray-400')}>
              {opt.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Filter chips including «همه» for list pages */
export function AdminChannelFilter({
  value,
  onChange,
  className,
}: {
  value: AdminChannel | 'ALL';
  onChange: (v: AdminChannel | 'ALL') => void;
  className?: string;
}) {
  const chips: { id: AdminChannel | 'ALL'; label: string }[] = [
    { id: 'ALL', label: 'همه' },
    { id: 'WHOLESALE', label: 'عمده' },
    { id: 'RETAIL', label: 'تکی' },
  ];
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={cn(
            'cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150',
            value === c.id
              ? c.id === 'RETAIL'
                ? 'bg-amber-600 text-white'
                : c.id === 'WHOLESALE'
                  ? 'bg-primary text-white'
                  : 'bg-secondary text-white'
              : 'bg-amber-50 text-amber-800 hover:bg-amber-100',
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function channelLabel(channel: AdminChannel | string): string {
  return channel === 'RETAIL' ? 'تکی' : 'عمده';
}

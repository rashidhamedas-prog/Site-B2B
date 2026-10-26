'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { CreditCard } from './sms-ui';

const LINKS = [
  { href: '/admin/sms', label: 'داشبورد', exact: true },
  { href: '/admin/sms/send', label: 'ارسال تکی' },
  { href: '/admin/sms/campaigns/new', label: 'ارسال انبوه' },
  { href: '/admin/sms/templates', label: 'قالب‌ها' },
  { href: '/admin/sms/contacts', label: 'مخاطبان' },
  { href: '/admin/sms/reports', label: 'گزارش‌ها' },
  { href: '/admin/sms/optout', label: 'لغو و سیاه' },
  { href: '/admin/sms/audit', label: 'فعالیت‌ها' },
  { href: '/admin/sms/settings', label: 'تنظیمات' },
];

export function AdminSmsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [credit, setCredit] = useState<number | null>(null);
  const [threshold, setThreshold] = useState(500);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    Promise.all([
      apiClient.get<{ amount: number }>('/admin/sms/credit').catch(() => null),
      apiClient.get<{ creditWarnThreshold?: number }>('/admin/sms/settings').catch(() => null),
    ])
      .then(([c, s]) => {
        if (c && typeof c.amount === 'number') setCredit(c.amount);
        else setErr('نامشخص');
        if (s?.creditWarnThreshold != null) setThreshold(s.creditWarnThreshold);
      })
      .catch(() => setErr('نامشخص'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">پنل پیامک</h1>
          <p className="text-sm text-gray-500">ارسال، کمپین، قالب و گزارش — واحد اعتبار: پیامک</p>
        </div>
        <div className="w-full max-w-xs">
          <CreditCard
            amount={err ? null : credit}
            threshold={threshold}
            loading={loading}
            error={err}
            onRetry={load}
          />
        </div>
      </div>

      <nav
        className="flex gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1"
        aria-label="منوی پنل پیامک"
      >
        {LINKS.map((l) => {
          const active = l.exact
            ? pathname === l.href
            : pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
                active ? 'bg-primary/15 text-primary' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}

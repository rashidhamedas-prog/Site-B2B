'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BarChart3,
  Home,
  Package,
  ShoppingBag,
  UserRound,
} from 'lucide-react';
import { clearToken } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { SpToastProvider, spFocusClass } from './SpUi';

const NAV = [
  { href: '/sales-partners', label: 'خانه', key: 'home', icon: Home },
  { href: '/sales-partners/catalog', label: 'محصولات', key: 'catalog', icon: Package },
  { href: '/sales-partners/orders', label: 'سفارش‌ها', key: 'orders', icon: ShoppingBag },
  { href: '/sales-partners/reports', label: 'گزارش', key: 'reports', icon: BarChart3 },
] as const;

const ACCOUNT = [
  { href: '/sales-partners/profile', label: 'شبا' },
  { href: '/sales-partners/commissions', label: 'پورسانت' },
  { href: '/sales-partners/payouts', label: 'تسویه' },
  { href: '/sales-partners/guide', label: 'آموزش' },
];

function navKey(pathname: string): (typeof NAV)[number]['key'] | 'account' | null {
  if (pathname === '/sales-partners' || pathname === '/sales-partners/') return 'home';
  if (pathname.startsWith('/sales-partners/catalog')) return 'catalog';
  if (pathname.startsWith('/sales-partners/orders')) return 'orders';
  if (pathname.startsWith('/sales-partners/reports')) return 'reports';
  if (
    pathname.startsWith('/sales-partners/profile')
    || pathname.startsWith('/sales-partners/commissions')
    || pathname.startsWith('/sales-partners/payouts')
    || pathname.startsWith('/sales-partners/guide')
  ) {
    return 'account';
  }
  return null;
}

export function SalesPartnerShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname() || '';
  const current = navKey(pathname);
  const reduce = useReducedMotion();

  return (
    <SpToastProvider>
      <div className="min-h-screen bg-[#f6f3ee] text-stone-900" dir="rtl">
        <div className="mx-auto min-h-screen max-w-lg px-4 pb-28 pt-5 text-right">
          <header className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-[#1B5C4A]">ترنم · همکار بازاریاب</p>
              <h1 className="truncate text-2xl font-semibold leading-8">{title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href="/sales-partners/profile"
                className={cn(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3 text-sm text-stone-700 shadow-sm',
                  spFocusClass,
                )}
              >
                <UserRound className="h-4 w-4" aria-hidden />
                حساب
              </Link>
              <button
                type="button"
                className={cn('min-h-11 rounded-full px-3 text-sm text-stone-600', spFocusClass)}
                onClick={() => {
                  clearToken();
                  window.location.href = '/sales-partners/login';
                }}
              >
                خروج
              </button>
            </div>
          </header>
          {current === 'account' && (
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="بخش‌های حساب">
              {ACCOUNT.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm transition-colors duration-200',
                      spFocusClass,
                      active ? 'bg-[#1B5C4A] text-white' : 'bg-white text-stone-700',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
          <div className="mt-5">{children}</div>
        </div>
        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200/80 bg-[#f6f3ee]/95 px-2 py-2 backdrop-blur-md"
          aria-label="ناوبری پنل همکار بازاریاب"
        >
          <ul className="mx-auto grid max-w-lg grid-cols-4 gap-1">
            {NAV.map((item) => {
              const active = current === item.key;
              const Icon = item.icon;
              return (
                <li key={item.href} className="min-w-0">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] transition-colors duration-200',
                      spFocusClass,
                      active ? 'font-semibold text-[#1B5C4A]' : 'text-stone-600',
                    )}
                  >
                    {active && !reduce ? (
                      <motion.span
                        layoutId="sp-nav-pill"
                        className="absolute inset-0 rounded-2xl bg-white shadow-sm"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    ) : active ? (
                      <span className="absolute inset-0 rounded-2xl bg-white shadow-sm" />
                    ) : null}
                    <Icon className="relative z-10 h-5 w-5" aria-hidden />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </SpToastProvider>
  );
}

export function SpNote({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-7 text-stone-600">{children}</p>;
}

export function SpAlert({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-red-50 p-3 text-sm leading-6 text-red-800" role="alert">
      {children}
    </p>
  );
}

export function SpStatus({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-stone-600" role="status">
      {children}
    </p>
  );
}

export function SpEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-4 text-sm leading-7 text-stone-600">
      {children}
    </p>
  );
}

export function SpCard({
  children,
  className = '',
  role,
  'aria-labelledby': ariaLabelledby,
}: {
  children: ReactNode;
  className?: string;
  role?: string;
  'aria-labelledby'?: string;
}) {
  return (
    <section
      role={role}
      aria-labelledby={ariaLabelledby}
      className={cn('rounded-2xl border border-stone-200 bg-white p-4 shadow-sm shadow-stone-900/5', className)}
    >
      {children}
    </section>
  );
}

export const spPrimary = cn(
  'inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[#1B5C4A] px-4 text-sm font-medium text-white shadow-sm shadow-[#1B5C4A]/15 transition-[transform,background-color] duration-200 hover:bg-[#164c3d] active:scale-[0.98] disabled:opacity-60 motion-reduce:active:scale-100',
  spFocusClass,
);
export const spSecondary = cn(
  'inline-flex min-h-11 items-center justify-center rounded-2xl border border-stone-300 bg-white px-4 text-sm text-stone-800 transition-[transform,border-color,background-color] duration-200 hover:border-[#1B5C4A]/40 hover:bg-[#1B5C4A]/5 active:scale-[0.98] motion-reduce:active:scale-100',
  spFocusClass,
);
export const spField = cn(
  'min-h-11 w-full min-w-0 rounded-2xl border border-stone-300 bg-white px-3 text-sm transition-shadow duration-200',
  spFocusClass,
);

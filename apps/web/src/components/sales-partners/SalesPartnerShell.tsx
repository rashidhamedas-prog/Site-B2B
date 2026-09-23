'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clearToken } from '@/lib/auth';

const NAV = [
  { href: '/sales-partners', label: 'خانه', key: 'home' },
  { href: '/sales-partners/catalog', label: 'محصولات', key: 'catalog' },
  { href: '/sales-partners/orders', label: 'سفارش‌ها', key: 'orders' },
  { href: '/sales-partners/profile', label: 'حساب', key: 'account' },
] as const;

const ACCOUNT = [
  { href: '/sales-partners/profile', label: 'شبا' },
  { href: '/sales-partners/commissions', label: 'پورسانت' },
  { href: '/sales-partners/payouts', label: 'تسویه' },
  { href: '/sales-partners/guide', label: 'آموزش' },
];

function navKey(pathname: string): (typeof NAV)[number]['key'] | null {
  if (pathname === '/sales-partners' || pathname === '/sales-partners/') return 'home';
  if (pathname.startsWith('/sales-partners/catalog')) return 'catalog';
  if (pathname.startsWith('/sales-partners/orders')) return 'orders';
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

const focus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C]';

export function SalesPartnerShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname() || '';
  const current = navKey(pathname);
  return (
    <div className="min-h-screen bg-[#f6f3ee] text-stone-900" dir="rtl">
      <div className="mx-auto min-h-screen max-w-lg px-4 pb-28 pt-5 text-right">
        <header className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#1B5C4A]">ترنم · همکار بازاریاب</p>
            <h1 className="truncate text-2xl font-semibold leading-8">{title}</h1>
          </div>
          <button
            type="button"
            className={`min-h-11 shrink-0 rounded-full px-3 text-sm text-stone-700 ${focus}`}
            onClick={() => {
              clearToken();
              window.location.href = '/sales-partners/login';
            }}
          >
            خروج
          </button>
        </header>
        {current === 'account' && (
          <nav className="mt-4 flex gap-2 overflow-x-auto" aria-label="بخش‌های حساب">
            {ACCOUNT.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm ${focus} ${
                    active ? 'bg-[#1B5C4A] text-white' : 'bg-white text-stone-700'
                  }`}
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
        className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-[#f6f3ee] px-3 py-2"
        aria-label="ناوبری پنل همکار بازاریاب"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          {NAV.map((item) => {
            const active = current === item.key;
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center justify-center rounded-2xl px-1 text-sm ${focus} ${
                    active ? 'bg-[#1B5C4A] font-medium text-white' : 'text-stone-700'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
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

export function SpCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-stone-200 bg-white p-4 ${className}`}>{children}</section>;
}

export const spPrimary =
  `inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[#1B5C4A] px-4 text-sm font-medium text-white disabled:opacity-60 ${focus}`;
export const spSecondary =
  `inline-flex min-h-11 items-center justify-center rounded-2xl border border-stone-300 bg-white px-4 text-sm text-stone-800 ${focus}`;
export const spField =
  `min-h-11 w-full min-w-0 rounded-2xl border border-stone-300 bg-white px-3 text-sm ${focus}`;

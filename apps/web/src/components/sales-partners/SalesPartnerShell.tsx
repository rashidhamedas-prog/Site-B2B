'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clearToken } from '@/lib/auth';

const NAV = [
  { href: '/sales-partners', label: 'خانه' },
  { href: '/sales-partners/catalog', label: 'محصولات قابل فروش' },
  { href: '/sales-partners/orders/new', label: 'سفارش جدید' },
  { href: '/sales-partners/orders', label: 'سفارش‌های من' },
  { href: '/sales-partners/commissions', label: 'پورسانت‌ها' },
  { href: '/sales-partners/payouts', label: 'تسویه‌ها' },
  { href: '/sales-partners/profile', label: 'پروفایل' },
  { href: '/sales-partners/guide', label: 'آموزش' },
];

export function SalesPartnerShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pb-24 pt-5 text-right" dir="rtl">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-stone-500">همکار بازاریاب</p>
          <h1 className="truncate text-xl font-bold">{title}</h1>
        </div>
        <button
          type="button"
          className="min-h-11 rounded-xl border border-stone-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1B5C4A]"
          onClick={() => {
            clearToken();
            window.location.href = '/sales-partners/login';
          }}
        >
          خروج
        </button>
      </header>
      <div className="mt-5">{children}</div>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 px-2 py-2"
        aria-label="ناوبری پنل همکار بازاریاب"
      >
        <ul className="mx-auto flex max-w-lg gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href} className="min-w-0 shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center rounded-xl px-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1B5C4A] ${
                    active ? 'bg-[#1B5C4A] text-white' : 'text-stone-700'
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

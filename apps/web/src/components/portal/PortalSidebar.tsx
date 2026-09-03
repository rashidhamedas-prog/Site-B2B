'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, FileText, CreditCard,
  User, Bell, LogOut, ChevronLeft, CalendarClock, Lock,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api';

const navItems = [
  { href: '/portal/dashboard', icon: LayoutDashboard, label: 'داشبورد', exact: true },
  { href: '/portal/dashboard/orders', icon: ShoppingCart, label: 'سفارش‌های من' },
  { href: '/portal/dashboard/invoices', icon: FileText, label: 'فاکتورها' },
  { href: '/portal/dashboard/payments', icon: CreditCard, label: 'پرداخت‌ها' },
  { href: '/portal/dashboard/installments', icon: CalendarClock, label: 'اقساط' },
  { href: '/portal/dashboard/profile', icon: User, label: 'پروفایل' },
  { href: '/portal/dashboard/security', icon: Lock, label: 'امنیت و رمز' },
  { href: '/portal/dashboard/notifications', icon: Bell, label: 'اعلان‌ها' },
];

export function PortalSidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [label, setLabel] = useState('مشتری ترنم');
  const [meta, setMeta] = useState('');

  useEffect(() => {
    apiClient
      .get<{ ownerName?: string; businessName?: string; customerCode?: string; segment?: string }>(
        '/auth/me/profile',
      )
      .then((me) => {
        setLabel(me.businessName || me.ownerName || 'مشتری ترنم');
        setMeta([me.customerCode, me.segment].filter(Boolean).join(' · '));
      })
      .catch(() => undefined);
  }, []);

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-white border-l border-gray-100 min-h-screen sticky top-0 h-screen">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100">
        <img src="/logo-128.png" alt="لوگوی پوشاک ترنم" className="h-10 w-10 object-contain" />
        <div>
          <p className="text-sm font-bold text-gray-900">پنل مشتری</p>
          <p className="text-xs text-gray-400">پوشاک ترنم</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5" aria-label="منوی پنل مشتری">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                active
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-primary'
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
              {active && <ChevronLeft className="h-3 w-3 mr-auto rtl-flip opacity-70" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <Link
          href="/products"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary-50 text-primary text-sm font-medium hover:bg-primary hover:text-white transition-colors"
        >
          <ShoppingCart className="h-4 w-4" />
          ثبت سفارش جدید
        </Link>
      </div>

      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary font-bold text-sm flex-shrink-0">
            {(label[0] || 'م').slice(0, 1)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
            <p className="text-xs text-gray-400 truncate">{meta || 'حساب عمده'}</p>
          </div>
          <button onClick={logout} className="text-gray-400 hover:text-error transition-colors" title="خروج">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

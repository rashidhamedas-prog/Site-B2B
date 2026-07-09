'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, Bell, ShoppingCart } from 'lucide-react';
import {
  LayoutDashboard, FileText, CreditCard, User,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

const PAGE_TITLES: Record<string, string> = {
  '/portal/dashboard': 'داشبورد',
  '/portal/dashboard/orders': 'سفارش‌های من',
  '/portal/dashboard/invoices': 'فاکتورها',
  '/portal/dashboard/payments': 'پرداخت‌ها',
  '/portal/dashboard/profile': 'پروفایل',
  '/portal/dashboard/notifications': 'اعلان‌ها',
};

const mobileNav = [
  { href: '/portal/dashboard', icon: LayoutDashboard, label: 'داشبورد' },
  { href: '/portal/dashboard/orders', icon: ShoppingCart, label: 'سفارش‌ها' },
  { href: '/portal/dashboard/invoices', icon: FileText, label: 'فاکتورها' },
  { href: '/portal/dashboard/payments', icon: CreditCard, label: 'پرداخت' },
  { href: '/portal/dashboard/profile', icon: User, label: 'پروفایل' },
];

export function PortalHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const title = PAGE_TITLES[pathname] ?? 'پنل مشتری';

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 h-16 flex items-center px-4 sm:px-6 gap-4">
        <button
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>

        <h1 className="text-lg font-bold text-gray-900">{title}</h1>

        <div className="mr-auto flex items-center gap-2">
          <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-error" />
          </button>
          <Link
            href="/products"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            سفارش جدید
          </Link>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-64 bg-white shadow-xl lg:hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <p className="font-bold text-gray-900">منو</p>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="p-3 space-y-0.5">
              {mobileNav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                      active ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, ShoppingCart, FileText, Package,
  CreditCard, BarChart3, Settings, Bell, Megaphone,
  Warehouse, UserCog, LogOut, X, ChevronDown,
  TrendingUp, Tag, PenSquare, Layers,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { clearToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  exact?: boolean;
  badge?: number;
  badgeColor?: string;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'نمای کلی',
    items: [
      { href: '/admin', icon: LayoutDashboard, label: 'داشبورد', exact: true },
      { href: '/admin/reports', icon: BarChart3, label: 'گزارش‌ها و آمار' },
    ],
  },
  {
    label: 'فروش',
    items: [
      { href: '/admin/customers', icon: Users, label: 'مشتریان (CRM)', badge: 0, badgeColor: 'bg-amber-500' },
      { href: '/admin/orders', icon: ShoppingCart, label: 'سفارش‌ها', badge: 0, badgeColor: 'bg-blue-500' },
      { href: '/admin/invoices', icon: FileText, label: 'فاکتورها' },
      { href: '/admin/payments', icon: CreditCard, label: 'پرداخت‌ها' },
    ],
  },
  {
    label: 'کالا',
    items: [
      { href: '/admin/products', icon: Package, label: 'محصولات' },
      { href: '/admin/categories', icon: Layers, label: 'دسته‌بندی‌ها' },
      { href: '/admin/inventory', icon: Warehouse, label: 'انبار' },
      { href: '/admin/discounts', icon: Tag, label: 'تخفیف‌ها' },
    ],
  },
  {
    label: 'رشد',
    items: [
      { href: '/admin/marketing', icon: Megaphone, label: 'بازاریابی' },
      { href: '/admin/blog', icon: PenSquare, label: 'وبلاگ' },
      { href: '/admin/analytics', icon: TrendingUp, label: 'آنالیتیکس' },
      { href: '/admin/notifications', icon: Bell, label: 'اعلان‌ها' },
    ],
  },
  {
    label: 'سیستم',
    items: [
      { href: '/admin/users', icon: UserCog, label: 'کاربران ادمین' },
      { href: '/admin/settings', icon: Settings, label: 'تنظیمات' },
    ],
  },
];

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ mobileOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const logout = () => { clearToken(); router.push('/admin/login'); };

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'));

  const toggleGroup = (label: string) =>
    setCollapsed(p => ({ ...p, [label]: !p[label] }));

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'fixed top-0 right-0 z-50 flex flex-col w-64 bg-[#0f172a] min-h-screen h-full transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 p-1 shadow-lg shadow-primary/20">
              <img src="/logo-128.png" alt="لوگوی پوشاک ترنم" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">ترنم</p>
              <p className="text-[10px] text-gray-400 leading-none">پنل مدیریت حرفه‌ای</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white p-1 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
          {navGroups.map((group) => (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className="flex items-center justify-between w-full px-2 mb-1.5 group"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-400 transition-colors">
                  {group.label}
                </p>
                <ChevronDown className={cn(
                  'h-3 w-3 text-gray-600 transition-transform',
                  collapsed[group.label] && '-rotate-90'
                )} />
              </button>

              {!collapsed[group.label] && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.href, item.exact);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group/item',
                          active
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                        )}
                      >
                        <item.icon className={cn(
                          'h-4 w-4 flex-shrink-0 transition-colors',
                          active ? 'text-primary' : 'text-gray-500 group-hover/item:text-gray-300'
                        )} />
                        <span className="flex-1">{item.label}</span>
                        {item.badge != null && item.badge > 0 && (
                          <span className={cn(
                            'flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white',
                            item.badgeColor ?? 'bg-error'
                          )}>
                            {item.badge}
                          </span>
                        )}
                        {active && (
                          <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Version + links */}
        <div className="px-4 py-2 border-t border-white/5">
          <Link href="/" target="_blank"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            مشاهده سایت
          </Link>
        </div>

        {/* User */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group">
            <div className="relative flex-shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-white font-bold text-sm">ح</div>
              <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-[#0f172a] bg-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">حامد رشید</p>
              <p className="text-[10px] text-gray-400">مدیر کل سیستم</p>
            </div>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-400/10"
              title="خروج از سیستم"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

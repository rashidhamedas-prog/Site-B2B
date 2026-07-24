'use client';

import { usePathname } from 'next/navigation';
import { Bell, Search, Menu, ExternalLink, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'داشبورد',
  '/admin/customers': 'مشتریان',
  '/admin/orders': 'سفارش‌ها',
  '/admin/invoices': 'فاکتورها',
  '/admin/payments': 'پرداخت‌ها',
  '/admin/products': 'محصولات',
  '/admin/categories': 'دسته‌بندی‌ها',
  '/admin/inventory': 'انبار',
  '/admin/blog': 'وبلاگ',
  '/admin/reports': 'گزارش‌ها',
  '/admin/marketing': 'بازاریابی',
  '/admin/analytics': 'آنالیتیکس',
  '/admin/discounts': 'تخفیف‌ها',
  '/admin/notifications': 'اعلان‌ها',
  '/admin/users': 'کاربران ادمین',
  '/admin/settings': 'تنظیمات',
};

const PAGE_SUBTITLES: Record<string, string> = {
  '/admin': 'نمای کلی وضعیت سیستم',
  '/admin/customers': 'مدیریت مشتریان و CRM',
  '/admin/orders': 'پردازش و پیگیری سفارش‌ها',
  '/admin/products': 'کاتالوگ محصولات',
  '/admin/inventory': 'مدیریت موجودی انبار',
  '/admin/reports': 'گزارش‌های فروش و مالی',
};

function getJalaliDate() {
  const d = new Date();
  const days = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  return d.toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' }) || days[d.getDay()];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'همین الان';
  if (mins < 60) return `${mins.toLocaleString('fa-IR')} دقیقه پیش`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs.toLocaleString('fa-IR')} ساعت پیش`;
  return `${Math.floor(hrs / 24).toLocaleString('fa-IR')} روز پیش`;
}

type Notif = { id: string; text: string; time: string; unread: boolean; color: string; href?: string };

interface AdminHeaderProps {
  onMenuToggle?: () => void;
}

export function AdminHeader({ onMenuToggle }: AdminHeaderProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notif[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stats = await apiClient.get<{
          customers: { pending: number };
          recentOrders: {
            id: string;
            orderNumber: string;
            customerName: string;
            total: number;
            status: string;
            createdAt: string;
          }[];
          lowStock: { id: string; color: string; size: string; stock: number }[];
        }>('/dashboard');

        const list: Notif[] = [];

        if (stats.customers.pending > 0) {
          list.push({
            id: 'pending-customers',
            text: `${stats.customers.pending.toLocaleString('fa-IR')} مشتری منتظر تأیید هستند`,
            time: 'بر اساس داده زنده',
            unread: true,
            color: 'bg-amber-500',
            href: '/admin/customers',
          });
        }

        stats.lowStock.slice(0, 3).forEach((v) => {
          list.push({
            id: `stock-${v.id}`,
            text: `موجودی ${v.color} / ${v.size} به ${v.stock.toLocaleString('fa-IR')} عدد رسید`,
            time: 'الان',
            unread: true,
            color: 'bg-red-500',
            href: '/admin/inventory',
          });
        });

        stats.recentOrders.slice(0, 4).forEach((o) => {
          list.push({
            id: `order-${o.id}`,
            text: `سفارش ${o.orderNumber} — ${o.customerName}`,
            time: timeAgo(o.createdAt),
            unread: o.status === 'PENDING_REVIEW',
            color: o.status === 'PENDING_REVIEW' ? 'bg-blue-500' : 'bg-green-500',
            href: `/admin/orders/${o.id}`,
          });
        });

        if (!cancelled) setNotifications(list.slice(0, 8));
      } catch {
        if (!cancelled) setNotifications([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const title =
    Object.entries(PAGE_TITLES)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([k]) => pathname.startsWith(k))?.[1] ?? 'مدیریت';

  const subtitle = Object.entries(PAGE_SUBTITLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([k]) => pathname.startsWith(k))?.[1];

  const unread = notifications.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-100 bg-white px-4 shadow-sm sm:px-6">
      <button
        type="button"
        onClick={onMenuToggle}
        className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0">
        <h1 className="text-base font-bold leading-tight text-gray-900">{title}</h1>
        {subtitle ? <p className="hidden text-xs text-gray-400 sm:block">{subtitle}</p> : null}
      </div>

      <div className="mr-auto flex items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs text-gray-400 md:flex">
          <Sun className="h-3.5 w-3.5 text-amber-400" />
          {getJalaliDate()}
        </div>

        {searchOpen ? (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-1.5">
            <Search className="h-4 w-4 flex-shrink-0 text-primary" />
            <input
              autoFocus
              placeholder="جستجو در سیستم..."
              onBlur={() => setSearchOpen(false)}
              className="w-40 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-400 transition-all hover:border-primary/30 hover:bg-primary/5 sm:flex"
          >
            <Search className="h-4 w-4" />
            <span>جستجو...</span>
          </button>
        )}

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center gap-1.5 rounded-xl p-2 text-xs text-gray-400 transition-colors hover:bg-gray-50 hover:text-primary md:flex"
        >
          <ExternalLink className="h-4 w-4" />
          سایت
        </a>

        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 ? (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            ) : null}
          </button>

          {notifOpen ? (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
              <div className="absolute left-0 top-12 z-40 w-80 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <h3 className="text-sm font-bold text-gray-900">اعلان‌ها</h3>
                  {unread > 0 ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                      {unread.toLocaleString('fa-IR')} جدید
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">بدون مورد جدید</span>
                  )}
                </div>
                <div className="max-h-72 divide-y divide-gray-50 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-gray-400">اعلانی از داده واقعی نیست</p>
                  ) : (
                    notifications.map((n) => (
                      <a
                        key={n.id}
                        href={n.href || '/admin/notifications'}
                        className={`flex cursor-pointer gap-3 px-4 py-3 hover:bg-gray-50 ${n.unread ? 'bg-blue-50/30' : ''}`}
                        onClick={() => setNotifOpen(false)}
                      >
                        <div
                          className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${n.color} ${n.unread ? 'opacity-100' : 'opacity-30'}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-gray-700">{n.text}</p>
                          <p className="mt-0.5 text-xs text-gray-400">{n.time}</p>
                        </div>
                      </a>
                    ))
                  )}
                </div>
                <div className="border-t border-gray-100 p-3 text-center">
                  <a href="/admin/notifications" className="text-xs text-primary hover:underline">
                    مشاهده همه اعلان‌ها
                  </a>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="relative">
          <div className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-sm font-bold text-white shadow-md ring-2 ring-white">
            ح
          </div>
        </div>
      </div>
    </header>
  );
}

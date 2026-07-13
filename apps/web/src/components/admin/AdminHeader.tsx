'use client';

import { usePathname } from 'next/navigation';
import { Bell, Search, Menu, ExternalLink, Sun } from 'lucide-react';
import { useState } from 'react';

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

// Jalali date — simple approximation
function getJalaliDate() {
  const d = new Date();
  // Simple offset — accurate enough for display
  const days = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
  const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  // 2026-07-01 ≈ 1405/04/10
  const day = days[d.getDay()];
  const month = months[(d.getMonth() + 3) % 12]; // rough offset
  const mDay = d.getDate();
  return `${day}، ${mDay} ${month}`;
}

interface AdminHeaderProps {
  onMenuToggle?: () => void;
}

export function AdminHeader({ onMenuToggle }: AdminHeaderProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const title = Object.entries(PAGE_TITLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([k]) => pathname.startsWith(k))?.[1] ?? 'مدیریت';

  const subtitle = Object.entries(PAGE_SUBTITLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([k]) => pathname.startsWith(k))?.[1];

  const notifications = [
    { id: 1, text: '۲ مشتری جدید منتظر تأیید هستند', time: '۱۵ دقیقه پیش', unread: true, color: 'bg-amber-500' },
    { id: 2, text: 'موجودی مانتو لینن مدل بهار به ۳ عدد رسید', time: '۱ ساعت پیش', unread: true, color: 'bg-red-500' },
    { id: 3, text: 'سفارش ORD-00012 تایید و ارسال شد', time: '۳ ساعت پیش', unread: false, color: 'bg-green-500' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100 h-16 flex items-center px-4 sm:px-6 gap-4 shadow-sm">
      {/* Mobile menu */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Title + Subtitle */}
      <div className="min-w-0">
        <h1 className="text-base font-bold text-gray-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 hidden sm:block">{subtitle}</p>}
      </div>

      {/* Right actions */}
      <div className="mr-auto flex items-center gap-2">
        {/* Date badge */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5">
          <Sun className="h-3.5 w-3.5 text-amber-400" />
          {getJalaliDate()}
        </div>

        {/* Search */}
        {searchOpen ? (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-1.5">
            <Search className="h-4 w-4 text-primary flex-shrink-0" />
            <input
              autoFocus
              placeholder="جستجو در سیستم..."
              onBlur={() => setSearchOpen(false)}
              className="w-40 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
            />
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-400 hover:border-primary/30 hover:bg-primary/5 transition-all"
          >
            <Search className="h-4 w-4" />
            <span>جستجو...</span>
            <kbd className="mr-1 text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 font-mono">Ctrl+K</kbd>
          </button>
        )}

        {/* View site */}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary transition-colors p-2 rounded-xl hover:bg-gray-50"
        >
          <ExternalLink className="h-4 w-4" />
          سایت
        </a>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
              <div className="absolute left-0 top-12 z-40 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-sm">اعلان‌ها</h3>
                  <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">
                    {notifications.filter(n => n.unread).length} جدید
                  </span>
                </div>
                <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {notifications.map(n => (
                    <div key={n.id} className={`flex gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer ${n.unread ? 'bg-blue-50/30' : ''}`}>
                      <div className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${n.color} ${n.unread ? 'opacity-100' : 'opacity-30'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 leading-snug">{n.text}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-gray-100 text-center">
                  <a href="/admin/notifications" className="text-xs text-primary hover:underline">مشاهده همه اعلان‌ها</a>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Avatar */}
        <div className="relative">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-white font-bold text-sm cursor-pointer ring-2 ring-white shadow-md">
            ح
          </div>
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-success" />
        </div>
      </div>
    </header>
  );
}

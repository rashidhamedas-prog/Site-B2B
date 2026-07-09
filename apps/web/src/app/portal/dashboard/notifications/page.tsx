'use client';

import { useState } from 'react';
import { Bell, Package, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Notification {
  id: string;
  type: 'order' | 'invoice' | 'system';
  title: string;
  body: string;
  date: string;
  read: boolean;
}

const SAMPLE: Notification[] = [
  { id: '1', type: 'system', title: 'خوش آمدید به پنل ترنم', body: 'حساب شما فعال شده و می‌توانید از کاتالوگ محصولات بازدید کنید.', date: '۱۴۰۳/۴/۱', read: false },
  { id: '2', type: 'order', title: 'کاتالوگ فصل تابستان آماده شد', body: 'مدل‌های جدید لینن و کتان تابستانی در کاتالوگ قرار گرفتند. برای مشاهده وارد بخش محصولات شوید.', date: '۱۴۰۳/۳/۲۰', read: true },
];

const icons = { order: Package, invoice: FileText, system: AlertCircle };

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(SAMPLE);

  const markRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">اعلان‌ها</h1>
          {unread > 0 && <p className="text-sm text-gray-500 mt-1">{unread} اعلان خوانده‌نشده</p>}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-sm text-primary hover:underline">
            همه را خوانده‌شده کن
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">هیچ اعلانی وجود ندارد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const Icon = icons[n.type];
            return (
              <button key={n.id} onClick={() => markRead(n.id)}
                className={cn('w-full text-right card p-4 flex items-start gap-4 hover:shadow-md transition-shadow',
                  !n.read && 'border-r-4 border-primary')}>
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  n.type === 'order' ? 'bg-blue-50' : n.type === 'invoice' ? 'bg-amber-50' : 'bg-primary-50')}>
                  <Icon className={cn('h-5 w-5',
                    n.type === 'order' ? 'text-blue-600' : n.type === 'invoice' ? 'text-amber-600' : 'text-primary')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('text-sm font-semibold', !n.read ? 'text-gray-900' : 'text-gray-600')}>{n.title}</p>
                    <span className="text-xs text-gray-400 flex-shrink-0">{n.date}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{n.body}</p>
                </div>
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

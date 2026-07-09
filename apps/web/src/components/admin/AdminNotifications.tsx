'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, UserPlus, ShoppingCart, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

interface DashboardStats {
  orders: { pending: number; thisMonth: number };
  customers: { pending: number };
  recentOrders: { id: string; orderNumber: string; customerName: string; total: number; status: string; createdAt: string }[];
  lowStock: { id: string; color: string; size: string; stock: number }[];
}

interface Notification {
  id: string;
  type: 'NEW_ORDER' | 'NEW_CUSTOMER' | 'LOW_STOCK';
  title: string;
  body: string;
  link?: string;
  time: string;
  read: boolean;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'همین الان';
  if (mins < 60) return `${mins} دقیقه پیش`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ساعت پیش`;
  return `${Math.floor(hrs / 24)} روز پیش`;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  NEW_ORDER:    <ShoppingCart className="h-5 w-5 text-blue-500" />,
  NEW_CUSTOMER: <UserPlus className="h-5 w-5 text-green-500" />,
  LOW_STOCK:    <AlertTriangle className="h-5 w-5 text-amber-500" />,
};

export function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const stats = await apiClient.get<DashboardStats>('/dashboard');
      const list: Notification[] = [];

      // pending orders
      stats.recentOrders.filter((o) => o.status === 'PENDING_REVIEW').forEach((o) => {
        list.push({
          id: `order-${o.id}`,
          type: 'NEW_ORDER',
          title: 'سفارش جدید در انتظار بررسی',
          body: `${o.orderNumber} — ${o.customerName} — ${Math.round(Number(o.total) / 10).toLocaleString('fa-IR')} تومان`,
          link: `/admin/orders/${o.id}`,
          time: o.createdAt,
          read: false,
        });
      });

      // low stock
      stats.lowStock.forEach((v) => {
        list.push({
          id: `stock-${v.id}`,
          type: 'LOW_STOCK',
          title: 'موجودی کم',
          body: `${v.color} / ${v.size} — فقط ${v.stock} عدد باقی مانده`,
          link: '/admin/inventory',
          time: new Date().toISOString(),
          read: false,
        });
      });

      // pending customers
      if (stats.customers.pending > 0) {
        list.push({
          id: 'pending-customers',
          type: 'NEW_CUSTOMER',
          title: `${stats.customers.pending} مشتری در انتظار تأیید`,
          body: 'درخواست‌های ثبت‌نام جدید نیاز به بررسی دارند',
          link: '/admin/customers',
          time: new Date().toISOString(),
          read: false,
        });
      }

      // other recent orders
      stats.recentOrders.filter((o) => o.status !== 'PENDING_REVIEW').slice(0, 3).forEach((o) => {
        list.push({
          id: `order-recent-${o.id}`,
          type: 'NEW_ORDER',
          title: `سفارش ${o.orderNumber}`,
          body: `${o.customerName} — وضعیت: ${o.status}`,
          link: `/admin/orders/${o.id}`,
          time: o.createdAt,
          read: true,
        });
      });

      // sort by time desc
      list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setNotifications(list);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markRead = (id: string) => setReadSet((p) => new Set([...p, id]));
  const markAllRead = () => setReadSet(new Set(notifications.map((n) => n.id)));

  const unread = notifications.filter((n) => !n.read && !readSet.has(n.id)).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />اعلان‌ها
            {unread > 0 && <span className="bg-primary text-white text-xs rounded-full px-2 py-0.5">{unread}</span>}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">رویدادها و هشدارهای سیستم</p>
        </div>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" />همه را خوانده‌شده علامت بزن
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />بروزرسانی
          </button>
        </div>
      </div>

      <div className="card divide-y divide-gray-50">
        {loading ? Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4"><div className="skeleton h-12 rounded" /></div>
        )) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">اعلانی وجود ندارد</p>
          </div>
        ) : notifications.map((n) => {
          const isRead = n.read || readSet.has(n.id);
          return (
            <div key={n.id} className={cn('flex items-start gap-4 p-4 transition-colors', !isRead && 'bg-blue-50/40')}>
              <div className={cn('flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center',
                n.type === 'NEW_ORDER' ? 'bg-blue-50' : n.type === 'NEW_CUSTOMER' ? 'bg-green-50' : 'bg-amber-50')}>
                {TYPE_ICON[n.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-semibold', isRead ? 'text-gray-600' : 'text-gray-900')}>{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.time)}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {n.link && (
                  <Link href={n.link} onClick={() => markRead(n.id)}
                    className="text-xs text-primary hover:underline">مشاهده</Link>
                )}
                {!isRead && (
                  <button onClick={() => markRead(n.id)} className="h-2 w-2 rounded-full bg-primary flex-shrink-0" title="علامت خوانده‌شده" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

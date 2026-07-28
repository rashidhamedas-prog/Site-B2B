'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, FileText, CreditCard, TrendingUp, RefreshCw } from 'lucide-react';
import { OrderStatusBadge, SegmentBadge } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

interface MyStats {
  generatedAt?: string;
  live?: boolean;
  ordersThisMonth: number;
  totalSpent: number;
  outstanding: number;
  creditRemaining: number;
  recentOrders: { id: string; orderNumber: string; status: string; total: number; itemCount: number; createdAt: string }[];
  customer: {
    businessName: string;
    ownerName: string;
    segment: string;
    customerCode: string;
    lastLoginAt?: string;
  } | null;
}

function toman(n: number) { return Math.round(Number(n) / 10).toLocaleString('fa-IR'); }

export function CustomerDashboard() {
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.get<MyStats>('/dashboard/mine');
      setStats(data);
    } catch (e: unknown) {
      setStats(null);
      setError(e instanceof Error ? e.message : 'خطا در دریافت آمار');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const kpis = stats ? [
    { label: 'سفارش‌های این ماه', value: stats.ordersThisMonth.toLocaleString('fa-IR'), icon: ShoppingCart, color: 'bg-blue-50 text-blue-600' },
    { label: 'مانده بدهی', value: toman(stats.outstanding), unit: 'تومان', icon: CreditCard, color: 'bg-amber-50 text-amber-600' },
    { label: 'مجموع خرید', value: toman(stats.totalSpent), unit: 'تومان', icon: TrendingUp, color: 'bg-green-50 text-green-600' },
    { label: 'اعتبار باقی‌مانده', value: toman(stats.creditRemaining), unit: 'تومان', icon: FileText, color: 'bg-primary-50 text-primary' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="card p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          {loading
            ? <div className="skeleton h-6 w-40 rounded mb-2" />
            : <h2 className="text-lg font-bold text-gray-900 mb-1">سلام، {stats?.customer?.ownerName || stats?.customer?.businessName || 'مشتری'} عزیز</h2>
          }
          <p className="text-sm text-gray-500">
            {error
              ? <span className="text-error">{error}</span>
              : stats?.customer?.lastLoginAt
                ? `آخرین ورود: ${new Date(stats.customer.lastLoginAt).toLocaleDateString('fa-IR')}`
                : 'خوش آمدید'}
            {stats?.generatedAt && !error && (
              <span className="mr-2 text-xs text-gray-400">
                · بروزرسانی {new Date(stats.generatedAt).toLocaleTimeString('fa-IR')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats?.customer && <SegmentBadge segment={stats.customer.segment} />}
          {stats?.customer?.customerCode && (
            <span className="text-xs text-gray-400">کد مشتری: {stats.customer.customerCode}</span>
          )}
          <button type="button" onClick={load} disabled={loading} className="text-gray-400 hover:text-primary" aria-label="بروزرسانی">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5"><div className="skeleton h-20 rounded" /></div>
        )) : kpis.map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className={cn('inline-flex h-10 w-10 items-center justify-center rounded-xl mb-3', stat.color)}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-xl font-extrabold text-gray-900">
              {stat.value}
              {stat.unit && <span className="text-sm font-medium text-gray-500 mr-1">{stat.unit}</span>}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">آخرین سفارش‌ها</h3>
          <Link href="/portal/dashboard/orders" className="text-sm text-primary hover:underline">مشاهده همه</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {loading ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-5"><div className="skeleton h-12 rounded" /></div>
          )) : !stats || stats.recentOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">هنوز سفارشی ثبت نشده</div>
          ) : stats.recentOrders.map((order) => (
            <Link key={order.id} href={`/portal/dashboard/orders/${order.id}`}
              className="flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary flex-shrink-0">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{order.orderNumber}</p>
                <p className="text-xs text-gray-400">
                  {new Date(order.createdAt).toLocaleDateString('fa-IR')} · {order.itemCount} کالا
                </p>
              </div>
              <div className="text-left flex-shrink-0">
                <OrderStatusBadge status={order.status} />
                <p className="text-sm font-bold text-gray-900 mt-1">{toman(order.total)} ت</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { href: '/products', icon: ShoppingCart, label: 'ثبت سفارش جدید', color: 'text-primary' },
          { href: '/portal/dashboard/invoices', icon: FileText, label: 'فاکتورها', color: 'text-blue-600' },
          { href: '/portal/dashboard/payments', icon: CreditCard, label: 'پرداخت‌ها', color: 'text-green-600' },
        ].map((action) => (
          <Link key={action.href} href={action.href}
            className="card-hover p-5 flex flex-col items-center gap-3 text-center">
            <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100', action.color)}>
              <action.icon className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium text-gray-700">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Eye, RefreshCw } from 'lucide-react';
import { ADMIN_ORDER_QUEUES, orderStatusLabelFa } from '@taranom/shared-types';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  DESK_SURFACES,
  attentionItems,
  channelLabel,
  growthSentence,
  orderChannel,
  type ChannelSnapshot,
  type DeskChannelKey,
  type DeskOps,
} from '@/lib/admin-desk';

interface DashboardStats {
  generatedAt?: string;
  live?: boolean;
  orders: { total: number; pending: number; thisMonth: number; lastMonth: number; growth: number };
  ordersByStatus?: Record<string, number>;
  customers: { total: number; pending: number; active: number };
  revenue: { total: number; thisMonth: number; lastMonth?: number; growth?: number; outstanding: number };
  recentOrders: {
    id: string;
    orderNumber: string;
    customerName: string;
    city: string;
    total: number;
    status: string;
    type?: string;
    createdAt: string;
  }[];
  lowStock: {
    id: string;
    color: string;
    size: string;
    stock: number;
    wholesaleStock?: number;
    retailStock?: number;
    productId: string;
    productName?: string;
  }[];
  topCustomers: { id: string; businessName: string; city: string; segment: string; totalSpend: number; orderCount: number }[];
  monthlyRevenue?: Array<{ label: string; value: number }>;
  monthlyOrders?: Array<{ label: string; value: number }>;
  channels?: { wholesale: ChannelSnapshot; retail: ChannelSnapshot };
  ops?: DeskOps;
}

function toman(n: number) {
  return Math.round(n / 10).toLocaleString('fa-IR');
}

function faNum(n: number) {
  return Math.max(0, Math.round(n)).toLocaleString('fa-IR');
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'همین الان';
  if (mins < 60) return `${faNum(mins)} دقیقه پیش`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${faNum(hrs)} ساعت پیش`;
  return `${faNum(Math.floor(hrs / 24))} روز پیش`;
}

const PIPELINE = ADMIN_ORDER_QUEUES.filter((key) => key !== 'DELETED');

const BAR: Record<string, string> = {
  AWAITING_PAYMENT: 'bg-[#C9A84C]',
  PENDING_REVIEW: 'bg-[#1B5C4A]',
  CONFIRMED: 'bg-[#1B5C4A]/70',
  PROCESSING: 'bg-[#1B5C4A]/55',
  SHIPPED: 'bg-[#2D7A5F]',
  DELIVERED: 'bg-[#2D7A5F]',
  COMPLETED: 'bg-[#0F2F28]',
  CANCELLED: 'bg-[#DC2626]',
};

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5C4A]';

const EMPTY: DashboardStats = {
  orders: { total: 0, pending: 0, thisMonth: 0, lastMonth: 0, growth: 0 },
  ordersByStatus: {},
  customers: { total: 0, pending: 0, active: 0 },
  revenue: { total: 0, thisMonth: 0, lastMonth: 0, growth: 0, outstanding: 0 },
  recentOrders: [],
  lowStock: [],
  topCustomers: [],
  monthlyRevenue: [],
  monthlyOrders: [],
};

function ChannelCard({
  channel,
  snap,
}: {
  channel: DeskChannelKey;
  snap: ChannelSnapshot;
}) {
  const retail = channel === 'retail';
  const ordersHref = `/admin/orders?channel=${retail ? 'RETAIL' : 'WHOLESALE'}`;
  return (
    <article className="overflow-hidden rounded-2xl border border-[#E8E0D4] bg-white">
      <div className={cn('h-1', retail ? 'bg-[#C9A84C]' : 'bg-[#1B5C4A]')} />
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold text-[#1A1A1A]">فروش {channelLabel(channel)}</h2>
          <span className="text-[11px] text-[#6B7280]">این ماه</span>
        </div>
        <p className="mt-3 text-3xl font-bold leading-none text-[#0F2F28] tabular-nums">{toman(snap.revenueThisMonth)}</p>
        <p className="mt-1 text-xs text-[#6B7280]">تومان · فقط سفارش ارسال‌شده</p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#E8E0D4] pt-4 sm:grid-cols-4">
          <div>
            <dt className="text-[11px] text-[#6B7280]">سفارش ثبت‌شده</dt>
            <dd className="mt-0.5 text-sm font-bold tabular-nums">
              <Link href={ordersHref} className={cn('rounded-sm hover:text-[#1B5C4A]', focusRing)}>{faNum(snap.ordersThisMonth)}</Link>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-[#6B7280]">مشتری فعال</dt>
            <dd className="mt-0.5 text-sm font-bold tabular-nums">{faNum(snap.activeCustomers)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-[#6B7280]">در انتظار بررسی</dt>
            <dd className="mt-0.5 text-sm font-bold tabular-nums">
              <Link href={`${ordersHref}&status=PENDING_REVIEW`} className={cn('rounded-sm hover:text-[#1B5C4A]', focusRing)}>
                {faNum(snap.pendingReview)}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-[#6B7280]">تیکت باز</dt>
            <dd className="mt-0.5 text-sm font-bold tabular-nums">
              <Link href="/admin/support" className={cn('rounded-sm hover:text-[#1B5C4A]', focusRing)}>{faNum(snap.openTickets)}</Link>
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiClient.get<DashboardStats>('/dashboard');
      setStats(data);
      setUsingFallback(false);
      setLoadError('');
    } catch (e: unknown) {
      if (!silent) {
        setStats(EMPTY);
        setUsingFallback(true);
        setLoadError(e instanceof Error ? e.message : 'اتصال به سرور داشبورد برقرار نشد');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const id = window.setInterval(() => load(true), 15000);
    const onFocus = () => load(true);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const monthlyRevenue = stats.monthlyRevenue ?? [];
  const revenueMonths = monthlyRevenue.map((m) => Math.round((Number(m.value) || 0) / 10_000_000));
  const maxMonth = Math.max(...revenueMonths, 1);
  const salesGrowth = stats.revenue.growth ?? 0;
  const statusMap = stats.ordersByStatus ?? {};
  const statusTotal = Math.max(
    PIPELINE.reduce((sum, key) => sum + (statusMap[key] ?? 0), 0),
    1,
  );
  const updatedLabel = stats.generatedAt
    ? `آخرین بروزرسانی: ${new Date(stats.generatedAt).toLocaleString('fa-IR')}`
    : 'داده زنده از دیتابیس';
  const queue = attentionItems(stats);
  const stockCount = stats.ops?.criticalStock ?? stats.lowStock.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#6B7280]">
          {usingFallback ? (
            <span className="text-amber-800">
              آمار بارگذاری نشد{loadError ? ` — ${loadError}` : ''}. اگر از فروشگاه وارد شده‌اید، از{' '}
              <Link href="/admin/login" className={cn('font-semibold text-[#1B5C4A] underline-offset-2 hover:underline', focusRing)}>
                ورود مدیریت
              </Link>{' '}
              دوباره وارد شوید.
            </span>
          ) : (
            <>
              {updatedLabel}
              <span className="mx-2 text-[#E8E0D4]">·</span>
              صف امروز، جدا برای عمده و تک
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => load(false)}
          disabled={loading}
          aria-label="بروزرسانی داشبورد"
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border border-[#E8E0D4] bg-white px-4 py-2 text-sm text-[#1A1A1A] hover:border-[#1B5C4A]/40',
            focusRing,
          )}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'motion-safe:animate-spin')} />
          بروزرسانی
        </button>
      </div>

      <section aria-label="کارهای امروز">
        {loading ? (
          <div className="h-16 rounded-2xl bg-white animate-pulse" />
        ) : usingFallback ? null : queue.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border border-[#E8E0D4] bg-white px-4 py-3 text-sm text-[#1B5C4A]">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            صف امروز خالی است. بررسی، پرداخت، تیکت، مرجوعی و موجودی کم چیزی ندارند.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {queue.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex h-full min-h-11 flex-col justify-center rounded-2xl border border-[#E8E0D4] bg-white px-3 py-3 hover:border-[#C9A84C] hover:bg-[#F6F1E8]',
                    focusRing,
                  )}
                >
                  <span className="text-[11px] text-[#6B7280]">{item.label}</span>
                  <span className="mt-1 text-sm font-bold text-[#1A1A1A]">{item.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {stats.channels && (
        <section className="grid gap-4 lg:grid-cols-2" aria-label="فروش به تفکیک سایت">
          <ChannelCard channel="wholesale" snap={stats.channels.wholesale} />
          <ChannelCard channel="retail" snap={stats.channels.retail} />
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-[#E8E0D4] bg-white p-5 lg:col-span-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#1A1A1A]">روند فروش ماهانه</h2>
              <p className="mt-1 text-xs text-[#6B7280]">شش ماه، میلیون تومان، بر اساس تاریخ ارسال</p>
            </div>
            <p className="text-xs font-semibold text-[#1B5C4A]">{growthSentence(salesGrowth)}</p>
          </div>
          {revenueMonths.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#6B7280]">هنوز فروش ارسال‌شده‌ای برای نمودار نیست</p>
          ) : (
            <div className="mt-5 flex h-40 items-end gap-2">
              {revenueMonths.map((value, i) => {
                const pct = Math.round((value / maxMonth) * 100);
                const last = i === revenueMonths.length - 1;
                return (
                  <div key={`${monthlyRevenue[i]?.label}-${i}`} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                    <div className="flex h-28 items-end" title={`${monthlyRevenue[i]?.label}: ${faNum(value)} میلیون تومان`}>
                      <div
                        className={cn('w-full rounded-t-md', last ? 'bg-[#1B5C4A]' : 'bg-[#1B5C4A]/35')}
                        style={{ height: `${value > 0 ? Math.max(pct, 8) : 0}%` }}
                      />
                    </div>
                    <span className="mt-2 truncate text-center text-[11px] text-[#6B7280]">{monthlyRevenue[i]?.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-[#E8E0D4] pt-4 text-sm">
            <div>
              <dt className="text-[11px] text-[#6B7280]">این ماه</dt>
              <dd className="font-bold tabular-nums">{toman(stats.revenue.thisMonth)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#6B7280]">مجموع ارسال‌شده</dt>
              <dd className="font-bold tabular-nums">{toman(stats.revenue.total)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#6B7280]">مطالبات</dt>
              <dd className="font-bold tabular-nums text-[#A88530]">{toman(stats.revenue.outstanding)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-[#E8E0D4] bg-white p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-[#1A1A1A]">وضعیت سفارش‌ها</h2>
          <ul className="mt-4 space-y-2.5">
            {PIPELINE.map((key) => {
              const count = statusMap[key] ?? 0;
              const pct = Math.round((count / statusTotal) * 100);
              return (
                <li key={key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <Link href={`/admin/orders?status=${key}`} className={cn('text-[#374151] hover:text-[#1B5C4A]', focusRing)}>
                      {orderStatusLabelFa(key)}
                    </Link>
                    <span className="font-semibold tabular-nums text-[#1A1A1A]">{faNum(count)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#F6F1E8]">
                    <div className={cn('h-full rounded-full', BAR[key] ?? 'bg-[#1B5C4A]')} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="overflow-hidden rounded-2xl border border-[#E8E0D4] bg-white lg:col-span-3">
          <div className="flex items-center justify-between border-b border-[#E8E0D4] px-5 py-4">
            <h2 className="text-sm font-bold text-[#1A1A1A]">سفارش‌های اخیر</h2>
            <Link href="/admin/orders" className={cn('text-xs font-semibold text-[#1B5C4A] hover:underline', focusRing)}>
              همه سفارش‌ها
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F6F1E8]/70">
                  <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-[#6B7280]">شماره</th>
                  <th className="hidden px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] sm:table-cell">مشتری</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280]">کانال</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280]">مبلغ</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280]">وضعیت</th>
                  <th className="hidden px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] md:table-cell">زمان</th>
                  <th className="px-3 py-2.5"><span className="sr-only">مشاهده</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3EEE6]">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-5 py-3"><div className="h-8 animate-pulse rounded bg-[#F6F1E8]" /></td>
                    </tr>
                  ))
                ) : stats.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-[#6B7280]">هنوز سفارشی ثبت نشده</td>
                  </tr>
                ) : (
                  stats.recentOrders.map((order) => {
                    const channel = orderChannel(order.type);
                    return (
                      <tr key={order.id} className="hover:bg-[#F6F1E8]/50">
                        <td className="px-5 py-3 font-mono text-xs font-semibold">{order.orderNumber}</td>
                        <td className="hidden px-3 py-3 sm:table-cell">
                          <p className="font-medium text-[#1A1A1A]">{order.customerName}</p>
                          <p className="text-[11px] text-[#6B7280]">{order.city || '—'}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            channel === 'retail' ? 'bg-[#C9A84C]/15 text-[#8A6A1F]' : 'bg-[#1B5C4A]/10 text-[#1B5C4A]',
                          )}>
                            {channelLabel(channel)}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-bold tabular-nums">{toman(order.total)}</td>
                        <td className="px-3 py-3 text-xs text-[#374151]">{orderStatusLabelFa(order.status)}</td>
                        <td className="hidden px-3 py-3 text-xs text-[#6B7280] md:table-cell">{timeAgo(order.createdAt)}</td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            aria-label={`مشاهده سفارش ${order.orderNumber}`}
                            className={cn('inline-flex h-11 w-11 items-center justify-center text-[#6B7280] hover:text-[#1B5C4A]', focusRing)}
                          >
                            <Eye className="h-4 w-4" aria-hidden />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-[#E8E0D4] bg-white">
            <div className="flex items-center gap-2 border-b border-[#E8E0D4] px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-[#A88530]" aria-hidden />
              <h2 className="text-sm font-bold text-[#1A1A1A]">موجودی زیر ۱۰</h2>
              {!loading && (
                <span className="mr-auto text-[11px] font-bold tabular-nums text-[#A88530]">{faNum(stockCount)}</span>
              )}
            </div>
            {loading ? (
              <div className="p-4"><div className="h-16 animate-pulse rounded bg-[#F6F1E8]" /></div>
            ) : stats.lowStock.length === 0 ? (
              <p className="flex items-center gap-2 p-4 text-xs text-[#1B5C4A]">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                موجودی عمده و تک بالای آستانه است
              </p>
            ) : (
              <ul className="divide-y divide-[#F3EEE6]">
                {stats.lowStock.map((item) => {
                  const wholesale = item.wholesaleStock ?? item.stock;
                  const retail = item.retailStock ?? 0;
                  return (
                    <li key={item.id}>
                      <Link href="/admin/inventory" className={cn('block px-4 py-3 hover:bg-[#F6F1E8]/60', focusRing)}>
                        <p className="truncate text-xs font-semibold text-[#1A1A1A]">
                          {item.productName ? `${item.productName} — ` : ''}{item.color} / سایز {item.size}
                        </p>
                        <p className="mt-1 text-[11px] text-[#6B7280]">
                          عمده {faNum(wholesale)} · تک {faNum(retail)}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="border-t border-[#E8E0D4] px-4 py-3">
              <Link href="/admin/inventory" className={cn('text-xs font-semibold text-[#1B5C4A] hover:underline', focusRing)}>
                انبار
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E8E0D4] bg-white">
            <div className="flex items-center justify-between border-b border-[#E8E0D4] px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-[#1A1A1A]">برترین مشتریان</h2>
                <p className="text-[11px] text-[#6B7280]">بر اساس سفارش ارسال‌شده</p>
              </div>
              <Link href="/admin/customers" className={cn('text-xs font-semibold text-[#1B5C4A] hover:underline', focusRing)}>همه</Link>
            </div>
            {loading ? (
              <div className="p-4"><div className="h-16 animate-pulse rounded bg-[#F6F1E8]" /></div>
            ) : stats.topCustomers.length === 0 ? (
              <p className="p-4 text-center text-xs text-[#6B7280]">هنوز فروش ارسال‌شده‌ای ثبت نشده</p>
            ) : (
              <ul className="divide-y divide-[#F3EEE6]">
                {stats.topCustomers.map((customer, index) => (
                  <li key={customer.id}>
                    <Link href={`/admin/customers/${customer.id}`} className={cn('flex items-center gap-3 px-4 py-3 hover:bg-[#F6F1E8]/60', focusRing)}>
                      <span className="w-5 text-center text-xs font-bold text-[#C9A84C]">{faNum(index + 1)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#1A1A1A]">{customer.businessName}</span>
                        <span className="block text-[11px] text-[#6B7280]">{customer.city || '—'} · {faNum(customer.orderCount)} سفارش</span>
                      </span>
                      <span className="text-xs font-bold tabular-nums">{toman(customer.totalSpend)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section aria-label="میزهای عمده و تک" className="rounded-2xl border border-[#E8E0D4] bg-white p-5">
        <h2 className="text-sm font-bold text-[#1A1A1A]">همه میزها</h2>
        <p className="mt-1 text-xs text-[#6B7280]">هر قابلیت فروش عمده و فروش تک از همین‌جا باز می‌شود.</p>
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {DESK_SURFACES.map((group) => (
            <div key={group.title}>
              <h3 className="text-[11px] font-bold tracking-wide text-[#1B5C4A]">{group.title}</h3>
              <ul className="mt-2">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 hover:bg-[#F6F1E8]',
                        focusRing,
                      )}
                    >
                      <span className="text-sm text-[#1A1A1A]">{item.label}</span>
                      <span className="truncate text-[11px] text-[#6B7280]">{item.hint}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

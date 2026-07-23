'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Users, ShoppingCart, CreditCard, AlertTriangle,
  ArrowUp, ArrowDown, Eye, RefreshCw, Clock, Package,
  CheckCircle2, XCircle, Plus, FileText, Wallet,
  MapPin, Activity,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

interface DashboardStats {
  orders: { total: number; pending: number; thisMonth: number; lastMonth: number; growth: number };
  ordersByStatus?: Record<string, number>;
  customers: { total: number; pending: number; active: number };
  revenue: { total: number; thisMonth: number; outstanding: number };
  recentOrders: { id: string; orderNumber: string; customerName: string; city: string; total: number; status: string; createdAt: string }[];
  lowStock: { id: string; color: string; size: string; stock: number; productId: string }[];
  topCustomers: { id: string; businessName: string; city: string; segment: string; totalSpend: number; orderCount: number }[];
  monthlyRevenue?: Array<{ label: string; value: number }>;
  monthlyOrders?: Array<{ label: string; value: number }>;
}

function toman(n: number) {
  return Math.round(n / 10).toLocaleString('fa-IR');
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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_REVIEW: { label: 'در انتظار بررسی', color: 'text-amber-700', bg: 'bg-amber-100' },
  PENDING:        { label: 'در انتظار', color: 'text-amber-700', bg: 'bg-amber-100' },
  CONFIRMED:      { label: 'تأیید شده', color: 'text-blue-700', bg: 'bg-blue-100' },
  PROCESSING:     { label: 'در حال پردازش', color: 'text-purple-700', bg: 'bg-purple-100' },
  SHIPPED:        { label: 'ارسال شده', color: 'text-teal-700', bg: 'bg-teal-100' },
  DELIVERED:      { label: 'تحویل داده', color: 'text-green-700', bg: 'bg-green-100' },
  COMPLETED:      { label: 'تکمیل شده', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  CANCELLED:      { label: 'لغو شده', color: 'text-red-700', bg: 'bg-red-100' },
};

const STATUS_FUNNEL: Array<{ key: string; label: string; color: string }> = [
  { key: 'PENDING_REVIEW', label: 'در انتظار بررسی', color: 'bg-amber-400' },
  { key: 'PROCESSING', label: 'در حال پردازش', color: 'bg-blue-400' },
  { key: 'CONFIRMED', label: 'تأیید شده', color: 'bg-violet-400' },
  { key: 'SHIPPED', label: 'ارسال شده', color: 'bg-teal-400' },
  { key: 'DELIVERED', label: 'تحویل داده شده', color: 'bg-emerald-500' },
  { key: 'COMPLETED', label: 'تکمیل شده', color: 'bg-emerald-600' },
];

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? { label: status, color: 'text-gray-700', bg: 'bg-gray-100' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c.bg} ${c.color}`}>
      {c.label}
    </span>
  );
}

// SVG Mini Sparkline
function Sparkline({ values, color = '#1B5C4A', height = 36 }: { values: number[]; color?: string; height?: number }) {
  if (!values.length) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 80;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: height - ((v - min) / range) * height * 0.8 - height * 0.1,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${path} L ${pts[pts.length - 1].x} ${height} L 0 ${height} Z`;
  return (
    <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace('#','')})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={color} />
    </svg>
  );
}

// SVG Bar Chart
function BarChart({ values, labels, color = '#1B5C4A' }: { values: number[]; labels: string[]; color?: string }) {
  const max = Math.max(...values) || 1;
  const h = 80;
  const w = 200;
  const barW = (w / values.length) * 0.6;
  const gap = (w / values.length) * 0.4;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h + 20}`} className="overflow-visible">
      {values.map((v, i) => {
        const bh = (v / max) * h;
        const x = i * (barW + gap) + gap / 2;
        return (
          <g key={i}>
            <rect
              x={x} y={h - bh} width={barW} height={bh}
              rx="3"
              fill={color}
              opacity={i === values.length - 1 ? 1 : 0.4}
            />
            <text x={x + barW / 2} y={h + 14} textAnchor="middle" fontSize="7" fill="#9ca3af" fontFamily="Vazirmatn">
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Quick action card
function QuickAction({ href, icon: Icon, label, color }: { href: string; icon: React.ElementType; label: string; color: string }) {
  return (
    <Link href={href} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-primary/30 hover:bg-primary/5 transition-all group`}>
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-medium text-gray-600 group-hover:text-primary">{label}</span>
    </Link>
  );
}

// Fallback data for when API is unavailable
const EMPTY: DashboardStats = {
  orders: { total: 0, pending: 0, thisMonth: 0, lastMonth: 0, growth: 0 },
  ordersByStatus: {},
  customers: { total: 0, pending: 0, active: 0 },
  revenue: { total: 0, thisMonth: 0, outstanding: 0 },
  recentOrders: [],
  lowStock: [],
  topCustomers: [],
  monthlyRevenue: [],
  monthlyOrders: [],
};

const SEGMENT_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  B: 'bg-blue-100 text-blue-700 border-blue-200',
  C: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<DashboardStats>('/dashboard');
      setStats(data);
      setUsingFallback(false);
    } catch {
      setStats(EMPTY);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const monthlyOrders = stats.monthlyOrders ?? [];
  const monthlyRevenue = stats.monthlyRevenue ?? [];
  const monthlyValues = monthlyOrders.map((m) => m.value);
  const revenueMonths = monthlyRevenue.map((m) => Math.round(m.value / 10_000_000) || 0);
  const monthLabels = monthlyRevenue.map((m) => m.label);
  const statusMap = stats.ordersByStatus ?? {};
  const statusTotal = Math.max(stats.orders.total, 1);

  const kpis = [
    {
      label: 'فروش این ماه',
      value: toman(stats.revenue.thisMonth),
      unit: 'تومان',
      change: stats.orders.growth >= 0 ? `+${stats.orders.growth}٪ نسبت به ماه قبل` : `${stats.orders.growth}٪`,
      up: stats.orders.growth >= 0,
      icon: TrendingUp,
      iconBg: 'bg-emerald-500',
      sparkValues: revenueMonths,
      sparkColor: '#10b981',
    },
    {
      label: 'سفارش‌های در انتظار',
      value: String(stats.orders.pending),
      unit: 'سفارش',
      change: `${stats.orders.thisMonth} سفارش این ماه`,
      up: true,
      icon: ShoppingCart,
      iconBg: 'bg-blue-500',
      sparkValues: monthlyValues,
      sparkColor: '#3b82f6',
    },
    {
      label: 'مشتریان فعال',
      value: String(stats.customers.active),
      unit: 'مشتری',
      change: stats.customers.pending > 0 ? `${stats.customers.pending} در انتظار تأیید` : 'همه تأیید شده',
      up: stats.customers.pending === 0,
      icon: Users,
      iconBg: 'bg-violet-500',
      sparkValues: [] as number[],
      sparkColor: '#8b5cf6',
    },
    {
      label: 'مطالبات معوق',
      value: toman(stats.revenue.outstanding),
      unit: 'تومان',
      change: 'فاکتورهای پرداخت نشده',
      up: false,
      icon: CreditCard,
      iconBg: 'bg-amber-500',
      sparkValues: [] as number[],
      sparkColor: '#f59e0b',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {usingFallback ? (
              <span className="text-amber-500">⚠ اتصال به API برقرار نشد — آمار خالی نمایش داده می‌شود</span>
            ) : (
              'آخرین بروزرسانی: همین الان'
            )}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm hover:shadow"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          بروزرسانی
        </button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <QuickAction href="/admin/orders" icon={ShoppingCart} label="سفارش جدید" color="bg-blue-100 text-blue-600" />
        <QuickAction href="/admin/customers" icon={Users} label="مشتری جدید" color="bg-violet-100 text-violet-600" />
        <QuickAction href="/admin/products" icon={Package} label="محصول جدید" color="bg-emerald-100 text-emerald-600" />
        <QuickAction href="/admin/invoices" icon={FileText} label="فاکتور جدید" color="bg-amber-100 text-amber-600" />
        <QuickAction href="/admin/inventory" icon={AlertTriangle} label="موجودی" color="bg-red-100 text-red-600" />
        <QuickAction href="/admin/payments" icon={Wallet} label="پرداخت‌ها" color="bg-teal-100 text-teal-600" />
        <QuickAction href="/admin/reports" icon={Activity} label="گزارش‌ها" color="bg-orange-100 text-orange-600" />
        <QuickAction href="/admin/marketing" icon={Plus} label="بازاریابی" color="bg-pink-100 text-pink-600" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ))
        ) : (
          kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.iconBg} text-white shadow-sm`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
                <span className={`flex items-center gap-0.5 text-xs font-medium ${kpi.up ? 'text-emerald-600' : 'text-red-500'}`}>
                  {kpi.up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {kpi.change}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-extrabold text-gray-900 leading-none">
                    {kpi.value}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{kpi.label} ({kpi.unit})</p>
                </div>
                {kpi.sparkValues.length > 0 && (
                  <div className="opacity-80">
                    <Sparkline values={kpi.sparkValues} color={kpi.sparkColor} height={36} />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Orders + Chart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">روند فروش ماهانه</h3>
                <p className="text-xs text-gray-400 mt-0.5">۶ ماه اخیر (میلیون تومان)</p>
              </div>
              <span className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded-full',
                stats.orders.growth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
              )}>
                {stats.orders.growth >= 0 ? '+' : ''}{stats.orders.growth}٪ نسبت به ماه قبل
              </span>
            </div>
            <div className="p-5">
              {revenueMonths.length > 0 ? (
                <BarChart values={revenueMonths} labels={monthLabels} color="#1B5C4A" />
              ) : (
                <p className="text-sm text-gray-400 py-8 text-center">هنوز داده فروشی برای نمودار ثبت نشده</p>
              )}
              <div className="flex gap-6 mt-4 pt-4 border-t border-gray-50">
                <div>
                  <p className="text-xs text-gray-400">این ماه</p>
                  <p className="font-bold text-gray-900">{toman(stats.revenue.thisMonth)} تومان</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">مجموع کل</p>
                  <p className="font-bold text-gray-900">{toman(stats.revenue.total)} تومان</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">معوق</p>
                  <p className="font-bold text-amber-600">{toman(stats.revenue.outstanding)} تومان</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent orders */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">سفارش‌های اخیر</h3>
              <Link href="/admin/orders" className="text-sm text-primary hover:underline font-medium">
                مشاهده همه ←
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-right text-xs font-semibold text-gray-500 px-5 py-2.5">شماره سفارش</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-2.5 hidden sm:table-cell">مشتری</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-2.5">مبلغ</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-2.5">وضعیت</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-2.5 hidden md:table-cell">زمان</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="px-5 py-3">
                          <div className="h-8 bg-gray-100 rounded animate-pulse" />
                        </td>
                      </tr>
                    ))
                  ) : stats.recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">
                        هنوز سفارشی ثبت نشده
                      </td>
                    </tr>
                  ) : (
                    stats.recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <span className="font-mono font-semibold text-gray-900 text-xs">{order.orderNumber}</span>
                        </td>
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{order.customerName}</p>
                            <p className="text-[11px] text-gray-400 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{order.city}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-bold text-gray-900 text-sm">{toman(order.total)}</span>
                          <span className="text-[10px] text-gray-400 mr-0.5">ت</span>
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-400 hidden md:table-cell">
                          {timeAgo(order.createdAt)}
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/admin/orders/${order.id}`} className="text-gray-300 hover:text-primary transition-colors">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Order funnel / stats */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-4">وضعیت سفارش‌ها</h3>
            <div className="space-y-3">
              {STATUS_FUNNEL.map((item) => {
                const count = statusMap[item.key] ?? 0;
                const pct = Math.round((count / statusTotal) * 100);
                return (
                  <div key={item.key}>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{item.label}</span>
                      <span className="font-semibold text-gray-700">{count.toLocaleString('fa-IR')}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {(statusMap.CANCELLED ?? 0) > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>لغو شده</span>
                    <span className="font-semibold text-gray-700">
                      {(statusMap.CANCELLED ?? 0).toLocaleString('fa-IR')}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-400 transition-all duration-700"
                      style={{ width: `${Math.round(((statusMap.CANCELLED ?? 0) / statusTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Low stock */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-gray-100">
              <div className="h-7 w-7 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm">موجودی بحرانی</h3>
              {!loading && (
                <span className="mr-auto text-[11px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">
                  {stats.lowStock.length} مورد
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                <div className="p-4"><div className="h-16 bg-gray-100 rounded animate-pulse" /></div>
              ) : stats.lowStock.length === 0 ? (
                <div className="p-4 flex items-center gap-2 text-xs text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  موجودی همه محصولات کافی است
                </div>
              ) : (
                stats.lowStock.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3">
                    <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0">
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800">{item.color} / سایز {item.size}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1 flex-1 rounded-full bg-gray-100">
                          <div
                            className={cn('h-1 rounded-full', item.stock <= 2 ? 'bg-red-500' : 'bg-amber-400')}
                            style={{ width: `${Math.min((item.stock / 10) * 100, 100)}%` }}
                          />
                        </div>
                        <span className={cn('text-[11px] font-bold', item.stock <= 2 ? 'text-red-500' : 'text-amber-600')}>
                          {item.stock} عدد
                        </span>
                      </div>
                    </div>
                    {item.stock <= 2 && <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-gray-100">
              <Link href="/admin/inventory" className="text-xs text-primary hover:underline font-medium">
                مدیریت انبار ←
              </Link>
            </div>
          </div>

          {/* Top customers */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">برترین مشتریان</h3>
              <Link href="/admin/customers" className="text-xs text-primary hover:underline font-medium">همه →</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                <div className="p-4"><div className="h-20 bg-gray-100 rounded animate-pulse" /></div>
              ) : stats.topCustomers.length === 0 ? (
                <div className="p-4 text-xs text-gray-400 text-center">هنوز مشتری با سفارش ثبت نشده</div>
              ) : (
                stats.topCustomers.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                    <span className="text-xs font-bold text-gray-300 w-5 text-center">{i + 1}</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs flex-shrink-0">
                      {c.businessName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.businessName}</p>
                      <p className="text-[11px] text-gray-400">{c.city} · {c.orderCount} سفارش</p>
                    </div>
                    <div className="text-left flex-shrink-0 space-y-1">
                      <span className={cn('inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full border', SEGMENT_COLORS[c.segment])}>
                        {c.segment}
                      </span>
                      <p className="text-xs font-bold text-gray-700">{toman(c.totalSpend)} ت</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pending approval */}
          {stats.customers.pending > 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-bold text-amber-800">
                  {stats.customers.pending} مشتری جدید
                </p>
              </div>
              <p className="text-xs text-amber-700 mb-3">در انتظار بررسی و تأیید عضویت هستند</p>
              <Link
                href="/admin/customers?status=PENDING"
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-xl transition-colors"
              >
                بررسی و تأیید
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

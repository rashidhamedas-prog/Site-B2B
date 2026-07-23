'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Users, ShoppingCart, CreditCard, Calendar, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

type Period = 'week' | 'month' | 'quarter' | 'year';

interface ReportsData {
  period: Period;
  kpis: {
    revenue: { value: number; change: number };
    orders: { value: number; change: number };
    avgOrder: { value: number; change: number };
    newCustomers: { value: number; change: number };
  };
  series: Array<{ label: string; value: number }>;
  byCity: Array<{ city: string; count: number; revenue: number }>;
  bySegment: Array<{ label: string; value: number; color: string }>;
  byFabric: Array<{ label: string; value: number; color: string }>;
  topProducts: Array<{
    rank: number;
    name: string;
    fabric: string;
    sold: number;
    revenue: number;
    growth: number;
  }>;
}

function toman(n: number) {
  return Math.round(n / 10).toLocaleString('fa-IR');
}

function fmtChange(n: number) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('fa-IR')}٪`;
}

function AreaChart({
  values, labels, color = '#1B5C4A', height = 160,
}: { values: number[]; labels: string[]; color?: string; height?: number }) {
  if (!values.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-gray-400">
        داده‌ای برای نمایش وجود ندارد
      </div>
    );
  }
  const max = Math.max(...values, 1) * 1.1;
  const w = 600;
  const h = height;
  const padT = 10;
  const padB = 24;
  const ih = h - padT - padB;
  const denom = Math.max(values.length - 1, 1);

  const pts = values.map((v, i) => ({
    x: (i / denom) * w,
    y: padT + ih - (v / max) * ih,
  }));

  const pathD = pts.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pts[i - 1];
    const cp1x = prev.x + (p.x - prev.x) / 3;
    const cp2x = p.x - (p.x - prev.x) / 3;
    return `C ${cp1x} ${prev.y}, ${cp2x} ${p.y}, ${p.x} ${p.y}`;
  }).join(' ');

  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${padT + ih} L 0 ${padT + ih} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <line key={p} x1={0} x2={w} y1={padT + ih * p} y2={padT + ih * p} stroke="#f1f5f9" strokeWidth="1" />
      ))}
      <path d={areaD} fill="url(#ag)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="white" stroke={color} strokeWidth="2" />
      ))}
      {labels.map((l, i) => (
        <text key={i} x={pts[i]?.x ?? 0} y={h - 2} textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="Vazirmatn">
          {l}
        </text>
      ))}
    </svg>
  );
}

function DonutChart({ segments, size = 100 }: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  if (!segments.length) {
    return <p className="text-xs text-gray-400 py-6 text-center">داده‌ای ثبت نشده</p>;
  }
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 36;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -90;
  const arcs = segments.map((seg) => {
    const sweep = (seg.value / total) * 360;
    const a1 = (angle * Math.PI) / 180;
    angle += sweep;
    const a2 = (angle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    return {
      ...seg,
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x2} ${y2} Z`,
      pct: seg.value / total,
    };
  });
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="#f8fafc" />
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} opacity="0.85" />)}
        <circle cx={cx} cy={cy} r={r * 0.6} fill="white" />
      </svg>
      <div className="space-y-1.5 flex-1">
        {arcs.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: a.color }} />
            <span className="text-xs text-gray-600 flex-1">{a.label}</span>
            <span className="text-xs font-bold text-gray-800">{Math.round(a.pct * 100).toLocaleString('fa-IR')}٪</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PERIOD_LABEL: Record<Period, string> = {
  week: '۷ روز اخیر',
  month: '۱۲ ماه اخیر',
  quarter: '۴ فصل اخیر',
  year: '۴ سال اخیر',
};

export function AdminReports() {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiClient.get<ReportsData>(`/dashboard/reports?period=${p}`);
      setData(res);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const chartValues = (data?.series ?? []).map((s) => Math.round(s.value / 10_000_000));
  const chartLabels = (data?.series ?? []).map((s) => s.label);
  const maxCityRevenue = Math.max(...(data?.byCity ?? []).map((c) => c.revenue), 1);

  const kpiCards = data ? [
    {
      label: 'مجموع فروش دوره',
      value: toman(data.kpis.revenue.value),
      unit: 'تومان',
      change: data.kpis.revenue.change,
      icon: TrendingUp,
      color: 'bg-emerald-500',
    },
    {
      label: 'تعداد سفارش‌ها',
      value: data.kpis.orders.value.toLocaleString('fa-IR'),
      unit: 'سفارش',
      change: data.kpis.orders.change,
      icon: ShoppingCart,
      color: 'bg-blue-500',
    },
    {
      label: 'میانگین سفارش',
      value: toman(data.kpis.avgOrder.value),
      unit: 'تومان',
      change: data.kpis.avgOrder.change,
      icon: CreditCard,
      color: 'bg-violet-500',
    },
    {
      label: 'مشتریان جدید',
      value: data.kpis.newCustomers.value.toLocaleString('fa-IR'),
      unit: 'مشتری',
      change: data.kpis.newCustomers.change,
      icon: Users,
      color: 'bg-amber-500',
    },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {error
            ? <span className="text-amber-600">⚠ دریافت گزارش از API ناموفق بود</span>
            : 'گزارش‌های فروش، مشتریان و محصولات بر اساس داده واقعی'}
        </p>
        <button
          type="button"
          onClick={() => load(period)}
          disabled={loading}
          className="flex items-center gap-2 text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-500 hover:bg-gray-50 transition-all"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          بروزرسانی
        </button>
      </div>

      <div className="flex gap-1.5 bg-gray-100 rounded-2xl p-1 w-fit">
        {(['week', 'month', 'quarter', 'year'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setPeriod(k)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              period === k ? 'bg-white text-primary shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {k === 'week' ? 'هفتگی' : k === 'month' ? 'ماهانه' : k === 'quarter' ? 'فصلی' : 'سالانه'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ))
        ) : kpiCards.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${kpi.color} text-white shadow-sm`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <span className={`text-xs font-bold ${kpi.change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {fmtChange(kpi.change)}
              </span>
            </div>
            <p className="text-xl font-extrabold text-gray-900">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.label} ({kpi.unit})</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-gray-900">روند درآمد</h3>
            <p className="text-xs text-gray-400 mt-0.5">میلیون تومان</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Calendar className="h-4 w-4" />
            {PERIOD_LABEL[period]}
          </div>
        </div>
        {loading ? (
          <div className="h-44 bg-gray-100 rounded-xl animate-pulse" />
        ) : (
          <AreaChart values={chartValues} labels={chartLabels} color="#1B5C4A" height={180} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-900">فروش بر اساس شهر</h3>
            <span className="text-xs text-gray-400">
              {(data?.byCity.length ?? 0) > 0 ? `${(data?.byCity.length ?? 0).toLocaleString('fa-IR')} شهر` : 'بدون داده'}
            </span>
          </div>
          {loading ? (
            <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          ) : !data?.byCity.length ? (
            <p className="text-sm text-gray-400 py-8 text-center">در این دوره فروشی ثبت نشده</p>
          ) : (
            <div className="space-y-3">
              {data.byCity.map((item) => (
                <div key={item.city} className="flex items-center gap-4">
                  <div className="w-14 text-sm font-medium text-gray-700 text-right flex-shrink-0">{item.city}</div>
                  <div className="flex-1 h-7 bg-gray-50 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg bg-gradient-to-l from-primary to-primary/60 transition-all duration-700"
                      style={{ width: `${(item.revenue / maxCityRevenue) * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center pr-3 text-xs font-semibold text-white drop-shadow">
                      {toman(item.revenue)} ت
                    </span>
                  </div>
                  <div className="w-16 text-xs text-gray-400 text-left">
                    {item.count.toLocaleString('fa-IR')} سفارش
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-4">توزیع سگمنت مشتریان</h3>
            {loading ? <div className="h-24 bg-gray-100 rounded animate-pulse" /> : (
              <DonutChart segments={data?.bySegment ?? []} size={100} />
            )}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-4">فروش بر اساس پارچه</h3>
            {loading ? <div className="h-24 bg-gray-100 rounded animate-pulse" /> : (
              <DonutChart segments={data?.byFabric ?? []} size={100} />
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">پرفروش‌ترین محصولات</h3>
          <Link href="/admin/products" className="text-sm text-primary hover:underline">مشاهده همه</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['#', 'محصول', 'پارچه', 'تعداد فروش', 'درآمد', 'رشد'].map((h) => (
                  <th key={h} className="text-right text-xs font-semibold text-gray-500 px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6">
                    <div className="h-16 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ) : !data?.topProducts.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">
                    در این دوره فروشی ثبت نشده
                  </td>
                </tr>
              ) : (
                data.topProducts.map((row) => (
                  <tr key={`${row.rank}-${row.name}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 font-bold">{row.rank.toLocaleString('fa-IR')}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{row.name}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-primary-50 text-primary font-medium px-2 py-0.5 rounded-full border border-primary/20">
                        {row.fabric}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-bold text-gray-900">{row.sold.toLocaleString('fa-IR')}</td>
                    <td className="px-5 py-3 font-bold text-gray-900">{toman(row.revenue)} ت</td>
                    <td className={`px-5 py-3 text-xs font-bold ${row.growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {fmtChange(row.growth)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

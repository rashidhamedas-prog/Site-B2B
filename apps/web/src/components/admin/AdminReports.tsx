'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Users, ShoppingCart, CreditCard, Download, Calendar, Filter } from 'lucide-react';

function toman(n: number) { return Math.round(n / 10).toLocaleString('fa-IR'); }

function AreaChart({
  values, labels, color = '#1B5C4A', height = 160,
}: { values: number[]; labels: string[]; color?: string; height?: number }) {
  if (!values.length) return null;
  const max = Math.max(...values) * 1.1;
  const w = 600; const h = height;
  const padT = 10; const padB = 24; const ih = h - padT - padB;

  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
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
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 36; const cx = size / 2; const cy = size / 2;
  let angle = -90;
  const arcs = segments.map((seg) => {
    const sweep = (seg.value / total) * 360;
    const a1 = (angle * Math.PI) / 180;
    angle += sweep;
    const a2 = (angle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(a1); const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2); const y2 = cy + r * Math.sin(a2);
    return { ...seg, d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x2} ${y2} Z`, pct: seg.value / total };
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
            <span className="text-xs font-bold text-gray-800">{Math.round(a.pct * 100)}٪</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

export function AdminReports() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  const revenueData: Record<string, number[]> = {
    week:    [12, 18, 15, 22, 28, 19, 25],
    month:   [38, 42, 55, 48, 61, 70, 48, 53, 66, 75, 62, 80],
    quarter: [150, 178, 195, 220],
    year:    [420, 510, 680, 750],
  };
  const revenueLabels: Record<string, string[]> = {
    week:    ['ش','ی','د','س','چ','پ','ج'],
    month:   MONTHS,
    quarter: ['Q1','Q2','Q3','Q4'],
    year:    ['۱۴۰۲','۱۴۰۳','۱۴۰۴','۱۴۰۵'],
  };

  const kpiCards = [
    { label: 'مجموع فروش سال', value: '۴۸۰,۰۰۰,۰۰۰', unit: 'تومان', change: '+۲۳٪', up: true, icon: TrendingUp, color: 'bg-emerald-500' },
    { label: 'تعداد سفارش‌ها', value: '۱۴۸', unit: 'سفارش', change: '+۱۵٪', up: true, icon: ShoppingCart, color: 'bg-blue-500' },
    { label: 'میانگین سفارش', value: '۳,۲۴۳,۰۰۰', unit: 'تومان', change: '+۸٪', up: true, icon: CreditCard, color: 'bg-violet-500' },
    { label: 'مشتریان جدید', value: '۳۲', unit: 'مشتری', change: '+۱۲٪', up: true, icon: Users, color: 'bg-amber-500' },
  ];

  const cityData = [
    { city: 'تهران', count: 42, revenue: 185000000 },
    { city: 'مشهد', count: 31, revenue: 140000000 },
    { city: 'اصفهان', count: 24, revenue: 98000000 },
    { city: 'شیراز', count: 18, revenue: 72000000 },
    { city: 'تبریز', count: 15, revenue: 58000000 },
    { city: 'سایر', count: 18, revenue: 67000000 },
  ];
  const maxRevenue = Math.max(...cityData.map(c => c.revenue));

  const segmentData = [
    { label: 'سگمنت A (VIP)', value: 15, color: '#1B5C4A' },
    { label: 'سگمنت B (نقره‌ای)', value: 28, color: '#C9A84C' },
    { label: 'سگمنت C (عادی)', value: 41, color: '#94a3b8' },
  ];

  const fabricData = [
    { label: 'لینن', value: 55, color: '#1B5C4A' },
    { label: 'کتان', value: 30, color: '#C9A84C' },
    { label: 'ترکیبی', value: 15, color: '#64748b' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">گزارش‌های جامع فروش، مشتریان و محصولات</p>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-500 hover:bg-gray-50 transition-all">
            <Filter className="h-4 w-4" />فیلتر
          </button>
          <button className="flex items-center gap-2 text-sm bg-primary text-white rounded-xl px-3 py-2 hover:bg-primary-dark transition-all shadow-sm">
            <Download className="h-4 w-4" />دریافت Excel
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-1.5 bg-gray-100 rounded-2xl p-1 w-fit">
        {(['week','month','quarter','year'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              period === k ? 'bg-white text-primary shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {k === 'week' ? 'هفتگی' : k === 'month' ? 'ماهانه' : k === 'quarter' ? 'فصلی' : 'سالانه'}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpiCards.map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${kpi.color} text-white shadow-sm`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <span className={`text-xs font-bold ${kpi.up ? 'text-emerald-600' : 'text-red-500'}`}>{kpi.change}</span>
            </div>
            <p className="text-xl font-extrabold text-gray-900">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.label} ({kpi.unit})</p>
          </div>
        ))}
      </div>

      {/* Area chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-gray-900">روند درآمد</h3>
            <p className="text-xs text-gray-400 mt-0.5">میلیون تومان</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Calendar className="h-4 w-4" />
            {period === 'week' ? 'این هفته' : period === 'month' ? 'این سال' : period === 'quarter' ? '۴ فصل اخیر' : '۴ سال اخیر'}
          </div>
        </div>
        <AreaChart values={revenueData[period]} labels={revenueLabels[period]} color="#1B5C4A" height={180} />
      </div>

      {/* City + donuts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-900">فروش بر اساس شهر</h3>
            <span className="text-xs text-gray-400">۶ شهر برتر</span>
          </div>
          <div className="space-y-3">
            {cityData.map((item) => (
              <div key={item.city} className="flex items-center gap-4">
                <div className="w-14 text-sm font-medium text-gray-700 text-right flex-shrink-0">{item.city}</div>
                <div className="flex-1 h-7 bg-gray-50 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full rounded-lg bg-gradient-to-l from-primary to-primary/60 transition-all duration-700"
                    style={{ width: `${(item.revenue / maxRevenue) * 100}%` }}
                  />
                  <span className="absolute inset-0 flex items-center pr-3 text-xs font-semibold text-white drop-shadow">
                    {toman(item.revenue)} ت
                  </span>
                </div>
                <div className="w-14 text-xs text-gray-400 text-left">{item.count} سفارش</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-4">توزیع سگمنت مشتریان</h3>
            <DonutChart segments={segmentData} size={100} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-4">فروش بر اساس پارچه</h3>
            <DonutChart segments={fabricData} size={100} />
          </div>
        </div>
      </div>

      {/* Top products */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">پرفروش‌ترین محصولات</h3>
          <Link href="/admin/products" className="text-sm text-primary hover:underline">مشاهده همه</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['#','محصول','پارچه','تعداد فروش','درآمد','رشد'].map(h => (
                  <th key={h} className="text-right text-xs font-semibold text-gray-500 px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { rank: 1, name: 'مانتو شومیزی لینن مدل بهار', fabric: 'لینن', sold: 48, revenue: 408000000, growth: '+24٪', up: true },
                { rank: 2, name: 'مانتو کتان مدل نسیم', fabric: 'کتان', sold: 36, revenue: 259200000, growth: '+18٪', up: true },
                { rank: 3, name: 'مانتو اسپرت مدل آفتاب', fabric: 'لینن کتان', sold: 29, revenue: 272600000, growth: '+11٪', up: true },
                { rank: 4, name: 'مانتو لینن مدل پریسا', fabric: 'لینن', sold: 22, revenue: 171600000, growth: '-3٪', up: false },
                { rank: 5, name: 'مانتو کتان مدل شکوفه', fabric: 'کتان', sold: 18, revenue: 145800000, growth: '+32٪', up: true },
              ].map(row => (
                <tr key={row.rank} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-400 font-bold">{row.rank}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{row.name}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-primary-50 text-primary font-medium px-2 py-0.5 rounded-full border border-primary/20">
                      {row.fabric}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-bold text-gray-900">{row.sold}</td>
                  <td className="px-5 py-3 font-bold text-gray-900">{toman(row.revenue)} ت</td>
                  <td className={`px-5 py-3 text-xs font-bold ${row.up ? 'text-emerald-600' : 'text-red-500'}`}>
                    {row.growth}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { AdminChannelTabs, type AdminChannel } from './AdminChannelTabs';

type Period = 'week' | 'month' | 'quarter' | 'year';

interface ReportsData {
  period: Period;
  error?: string;
  warnings?: string[];
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
  pipeline?: {
    placed: number;
    awaitingPayment: number;
    pendingReview: number;
    inFulfillment: number;
    recognized: number;
    cancelled: number;
  };
  payments?: Array<{ method: string; label: string; count: number; revenue: number }>;
  returns?: { opened: number; openNow: number };
  adjustments?: { discount: number; shipping: number };
  invoices?: { count: number; amount: number };
}

function toman(n: number) {
  return Math.round((Number(n) || 0) / 10).toLocaleString('fa-IR');
}

function fa(n: number) {
  return Math.round(Number(n) || 0).toLocaleString('fa-IR');
}

function changeSentence(n: number) {
  const value = Math.round(Number(n) || 0);
  if (value > 0) return `${fa(value)}٪ بیشتر از دوره قبل`;
  if (value < 0) return `${fa(Math.abs(value))}٪ کمتر از دوره قبل`;
  return 'هم‌اندازه دوره قبل';
}

const PERIOD_LABEL: Record<Period, string> = {
  week: '۷ روز اخیر',
  month: '۱۲ ماه اخیر',
  quarter: '۴ فصل اخیر',
  year: '۴ سال اخیر',
};

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5C4A]';

function TrendChart({ values, labels }: { values: number[]; labels: string[] }) {
  if (!values.length || values.every((value) => value <= 0)) {
    return (
      <p className="py-10 text-center text-sm text-[#6B7280]">
        در این بازه فروش قطعی ثبت نشده. سفارش پرداخت‌نشده یا در صف بررسی اینجا نمی‌آید.
      </p>
    );
  }
  const max = Math.max(...values, 1);
  const w = 640;
  const h = 168;
  const padT = 12;
  const padB = 28;
  const ih = h - padT - padB;
  const denom = Math.max(values.length - 1, 1);
  const pts = values.map((value, index) => ({
    x: (index / denom) * w,
    y: padT + ih - (value / max) * ih,
  }));
  const pathD = pts.map((point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev = pts[index - 1];
    const cp1x = prev.x + (point.x - prev.x) / 3;
    const cp2x = point.x - (point.x - prev.x) / 3;
    return `C ${cp1x} ${prev.y}, ${cp2x} ${point.y}, ${point.x} ${point.y}`;
  }).join(' ');
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${padT + ih} L 0 ${padT + ih} Z`;

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-hidden="true" className="overflow-visible">
        <path d={areaD} fill="#1B5C4A" opacity="0.12" />
        <path d={pathD} fill="none" stroke="#1B5C4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((point, index) => (
          <circle key={labels[index] ?? index} cx={point.x} cy={point.y} r="3.5" fill="#fff" stroke="#1B5C4A" strokeWidth="2" />
        ))}
        {labels.map((label, index) => (
          <text key={label} x={pts[index]?.x ?? 0} y={h - 4} textAnchor="middle" fontSize="11" fill="#6B7280">
            {label}
          </text>
        ))}
      </svg>
      <table className="sr-only">
        <caption>روند فروش قطعی به تومان</caption>
        <tbody>
          {labels.map((label, index) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{toman(values[index] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankBars({
  rows,
  empty,
}: {
  rows: Array<{ key: string; label: string; amount: string; hint: string; width: number }>;
  empty: string;
}) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-[#6B7280]">{empty}</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-[#1A1A1A]">{row.label}</span>
            <span className="shrink-0 text-xs tabular-nums text-[#374151]">
              <span className="font-semibold text-[#0F2F28]">{row.amount}</span>
              <span className="mr-2 text-[#6B7280]">{row.hint}</span>
            </span>
          </div>
          <span className="block h-1.5 overflow-hidden rounded-full bg-[#F3EFE7]">
            <span
              className="block h-full rounded-full bg-[#1B5C4A] motion-safe:transition-[width] motion-safe:duration-300"
              style={{ width: `${Math.max(4, row.width)}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

const COVERAGE = [
  { href: '/admin/orders', label: 'سفارش‌ها' },
  { href: '/admin/invoices', label: 'فاکتورها' },
  { href: '/admin/payments', label: 'پرداخت‌ها' },
  { href: '/admin/rma', label: 'مرجوعی' },
  { href: '/admin/discounts', label: 'تخفیف‌ها' },
  { href: '/admin/customers', label: 'مشتریان' },
  { href: '/admin/products', label: 'محصولات' },
  { href: '/admin/inventory', label: 'انبار' },
  { href: '/admin/support', label: 'تیکت' },
  { href: '/admin/sales-partners', label: 'همکار بازاریاب' },
];

export function AdminReports() {
  const [period, setPeriod] = useState<Period>('month');
  const [channel, setChannel] = useState<AdminChannel>('WHOLESALE');
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (nextPeriod: Period, nextChannel: AdminChannel) => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiClient.get<ReportsData>(`/dashboard/reports?period=${nextPeriod}&channel=${nextChannel}`);
      setData(res);
      setError(Boolean(res?.error));
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period, channel); }, [period, channel, load]);

  const retail = channel === 'RETAIL';
  const accent = retail ? 'bg-[#C9A84C]' : 'bg-[#1B5C4A]';
  const ordersHref = `/admin/orders?channel=${channel}`;
  const chartValues = (data?.series ?? []).map((point) => point.value);
  const chartLabels = (data?.series ?? []).map((point) => point.label);
  const maxCity = Math.max(...(data?.byCity ?? []).map((row) => row.revenue), 1);
  const maxPay = Math.max(...(data?.payments ?? []).map((row) => row.revenue), 1);
  const maxFabric = Math.max(...(data?.byFabric ?? []).map((row) => row.value), 1);
  const maxSegment = Math.max(...(data?.bySegment ?? []).map((row) => row.value), 1);
  const pipeline = data?.pipeline;

  const ops = pipeline ? [
    { href: ordersHref, label: 'ثبت‌شده', value: fa(pipeline.placed), note: 'در این بازه' },
    { href: `${ordersHref}&status=AWAITING_PAYMENT`, label: 'منتظر پرداخت', value: fa(pipeline.awaitingPayment), note: 'هنوز فروش نیست' },
    { href: `${ordersHref}&status=PENDING_REVIEW`, label: 'بررسی', value: fa(pipeline.pendingReview), note: 'صف تأیید' },
    { href: ordersHref, label: 'آماده‌سازی', value: fa(pipeline.inFulfillment), note: 'تأیید تا بسته‌بندی' },
    { href: `${ordersHref}&status=CANCELLED`, label: 'لغو', value: fa(pipeline.cancelled), note: 'از فروش قطعی خارج است' },
    { href: '/admin/rma', label: 'مرجوعی باز', value: fa(data?.returns?.openNow ?? 0), note: `${fa(data?.returns?.opened ?? 0)} درخواست در دوره` },
  ] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm leading-6 text-[#374151]">
            فروش قطعی فقط سفارش ارسال‌شده، تحویل‌شده یا تکمیل‌شده است و با تاریخ ارسال حساب می‌شود.
            وضعیت صف، تاریخ ثبت سفارش را می‌شمارد.
          </p>
          <p className="mt-1 text-xs text-[#6B7280]">
            {retail ? 'سایت تک · poshaktaranom.ir' : 'سایت عمده · poshaktaranom.com'}
            {' · '}
            {PERIOD_LABEL[period]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminChannelTabs value={channel} onChange={setChannel} />
          <button
            type="button"
            onClick={() => load(period, channel)}
            disabled={loading}
            className={cn(
              'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#E8E0D4] bg-white px-3 text-sm text-[#374151]',
              focusRing,
            )}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'motion-safe:animate-spin')} aria-hidden="true" />
            بروزرسانی
          </button>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-xl bg-[#F3EFE7] p-1" role="group" aria-label="بازه گزارش">
        {(['week', 'month', 'quarter', 'year'] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={period === key}
            onClick={() => setPeriod(key)}
            className={cn(
              'cursor-pointer rounded-lg px-4 py-2 text-sm',
              focusRing,
              period === key ? 'bg-white font-bold text-[#0F2F28] shadow-sm' : 'text-[#6B7280]',
            )}
          >
            {key === 'week' ? 'هفتگی' : key === 'month' ? 'ماهانه' : key === 'quarter' ? 'فصلی' : 'سالانه'}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          {data?.error ? `گزارش کامل نشد: ${data.error}` : 'دریافت گزارش ناموفق بود. دوباره بروزرسانی کنید.'}
        </p>
      )}
      {(data?.warnings?.length ?? 0) > 0 && (
        <p className="rounded-xl border border-[#E8E0D4] bg-[#FBF8F3] px-4 py-3 text-sm text-[#374151]">
          این بخش‌ها جداگانه خطا دادند و بقیه اعداد سر جایشان مانده‌اند: {data?.warnings?.join('، ')}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#E8E0D4] bg-white">
        <div className={cn('h-1', accent)} />
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <p className="text-xs text-[#6B7280]">فروش قطعی دوره</p>
            {loading ? (
              <div className="mt-3 h-10 w-48 animate-pulse rounded-lg bg-[#F3EFE7]" />
            ) : (
              <>
                <p className="mt-2 text-4xl font-bold tabular-nums leading-none text-[#0F2F28]">
                  {toman(data?.kpis.revenue.value ?? 0)}
                </p>
                <p className="mt-2 text-sm text-[#374151]">
                  تومان · {changeSentence(data?.kpis.revenue.change ?? 0)}
                </p>
              </>
            )}
          </div>
          <dl className="grid grid-cols-3 gap-3 border-[#E8E0D4] lg:border-r lg:pr-6">
            {[
              ['سفارش قطعی', fa(data?.kpis.orders.value ?? 0), changeSentence(data?.kpis.orders.change ?? 0)],
              ['میانگین سفارش', toman(data?.kpis.avgOrder.value ?? 0), 'تومان'],
              ['مشتری جدید', fa(data?.kpis.newCustomers.value ?? 0), retail ? 'خریدار تک' : 'مشتری عمده'],
            ].map(([label, value, note]) => (
              <div key={label}>
                <dt className="text-[11px] text-[#6B7280]">{label}</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums text-[#1A1A1A]">{loading ? '…' : value}</dd>
                <dd className="text-[11px] leading-4 text-[#6B7280]">{note}</dd>
              </div>
            ))}
          </dl>
        </div>
        {!loading && data?.adjustments && (
          <div className="grid gap-3 border-t border-[#E8E0D4] px-5 py-3 text-xs text-[#374151] sm:grid-cols-3">
            <p>تخفیف روی فروش قطعی: <span className="font-semibold tabular-nums">{toman(data.adjustments.discount)} تومان</span></p>
            <p>ارسال روی فروش قطعی: <span className="font-semibold tabular-nums">{toman(data.adjustments.shipping)} تومان</span></p>
            <p>
              <Link href="/admin/invoices" className={cn('underline decoration-[#E8E0D4] underline-offset-4', focusRing)}>
                فاکتور باز الان
              </Link>
              {': '}
              <span className="font-semibold tabular-nums">
                {fa(data.invoices?.count ?? 0)} فقره · {toman(data.invoices?.amount ?? 0)} تومان
              </span>
            </p>
          </div>
        )}
      </section>

      {ops.length > 0 && (
        <section aria-label="وضعیت سفارش‌های ثبت‌شده در این بازه">
          <h2 className="mb-2 text-sm font-bold text-[#1A1A1A]">صف همین بازه</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {ops.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn('block h-full rounded-xl border border-[#E8E0D4] bg-white px-3 py-3', focusRing)}
                >
                  <span className="block text-[11px] text-[#6B7280]">{item.label}</span>
                  <span className="mt-1 block text-xl font-bold tabular-nums text-[#0F2F28]">{item.value}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-[#6B7280]">{item.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-[#E8E0D4] bg-white p-5">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold text-[#1A1A1A]">روند فروش قطعی</h2>
          <p className="text-xs text-[#6B7280]">تومان · {PERIOD_LABEL[period]}</p>
        </div>
        {loading ? (
          <div className="h-40 animate-pulse rounded-xl bg-[#F3EFE7]" />
        ) : (
          <TrendChart values={chartValues} labels={chartLabels} />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#E8E0D4] bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-[#1A1A1A]">شهر، روی فروش قطعی</h2>
          {loading ? <div className="h-32 animate-pulse rounded-xl bg-[#F3EFE7]" /> : (
            <RankBars
              empty="در این دوره فروش قطعی با شهر مشتری ثبت نشده."
              rows={(data?.byCity ?? []).map((row) => ({
                key: row.city,
                label: row.city,
                amount: toman(row.revenue),
                hint: `${fa(row.count)} سفارش`,
                width: (row.revenue / maxCity) * 100,
              }))}
            />
          )}
        </section>
        <section className="rounded-2xl border border-[#E8E0D4] bg-white p-5">
          <h2 className="mb-1 text-sm font-bold text-[#1A1A1A]">روش پرداخت فروش قطعی</h2>
          <p className="mb-4 text-xs text-[#6B7280]">
            {retail ? 'آنلاین، درگاه و پرداخت در محل' : 'اعتبار، اقساط، نقد و آنلاین'}
          </p>
          {loading ? <div className="h-32 animate-pulse rounded-xl bg-[#F3EFE7]" /> : (
            <RankBars
              empty="روش پرداختی برای فروش قطعی این دوره نیست."
              rows={(data?.payments ?? []).map((row) => ({
                key: row.method,
                label: row.label,
                amount: toman(row.revenue),
                hint: `${fa(row.count)} سفارش`,
                width: (row.revenue / maxPay) * 100,
              }))}
            />
          )}
        </section>
      </div>

      <div className={cn('grid gap-4', channel === 'WHOLESALE' && 'lg:grid-cols-2')}>
        {channel === 'WHOLESALE' && (
          <section className="rounded-2xl border border-[#E8E0D4] bg-white p-5">
            <h2 className="mb-1 text-sm font-bold text-[#1A1A1A]">درجه اعتباری مشتریان عمده</h2>
            <p className="mb-4 text-xs text-[#6B7280]">موجودی فعلی دفتر مشتری است، نه فقط تازه‌واردهای این دوره.</p>
            {loading ? <div className="h-24 animate-pulse rounded-xl bg-[#F3EFE7]" /> : (
              <RankBars
                empty="مشتری عمده‌ای با سگمنت ثبت نشده."
                rows={(data?.bySegment ?? []).map((row) => ({
                  key: row.label,
                  label: row.label,
                  amount: fa(row.value),
                  hint: 'مشتری',
                  width: (row.value / maxSegment) * 100,
                }))}
              />
            )}
          </section>
        )}
        <section className="rounded-2xl border border-[#E8E0D4] bg-white p-5">
          <h2 className="mb-1 text-sm font-bold text-[#1A1A1A]">پارچه در فروش قطعی</h2>
          <p className="mb-4 text-xs text-[#6B7280]">از مشخصات محصول؛ اگر پارچه خالی باشد در «نامشخص» جمع می‌شود.</p>
          {loading ? <div className="h-24 animate-pulse rounded-xl bg-[#F3EFE7]" /> : (
            <RankBars
              empty="فروش قطعی این دوره به پارچه وصل نشده."
              rows={(data?.byFabric ?? []).map((row) => ({
                key: row.label,
                label: row.label,
                amount: toman(row.value),
                hint: 'تومان',
                width: (row.value / maxFabric) * 100,
              }))}
            />
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#E8E0D4] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#E8E0D4] px-5 py-4">
          <h2 className="text-sm font-bold text-[#1A1A1A]">پرفروش‌ها بر اساس مبلغ قطعی</h2>
          <Link href="/admin/products" className={cn('text-sm text-[#1B5C4A] underline decoration-[#E8E0D4] underline-offset-4', focusRing)}>
            فهرست محصولات
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="bg-[#FBF8F3]">
                {['رتبه', 'محصول', 'پارچه', 'تعداد', 'مبلغ', 'نسبت به دوره قبل'].map((heading) => (
                  <th key={heading} scope="col" className="px-5 py-3 text-right text-xs font-semibold text-[#6B7280]">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-6"><div className="h-12 animate-pulse rounded-lg bg-[#F3EFE7]" /></td></tr>
              ) : !data?.topProducts.length ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-[#6B7280]">فروش قطعی این دوره محصولی برای رتبه‌بندی ندارد.</td></tr>
              ) : data.topProducts.map((row) => (
                <tr key={`${row.rank}-${row.name}`} className="border-t border-[#F3EFE7]">
                  <td className="px-5 py-3 tabular-nums text-[#6B7280]">{fa(row.rank)}</td>
                  <td className="max-w-[16rem] px-5 py-3 font-medium text-[#1A1A1A]"><span className="block min-w-0 truncate">{row.name}</span></td>
                  <td className="px-5 py-3 text-[#374151]">{row.fabric}</td>
                  <td className="px-5 py-3 font-semibold tabular-nums">{fa(row.sold)}</td>
                  <td className="px-5 py-3 font-semibold tabular-nums">{toman(row.revenue)}</td>
                  <td className="px-5 py-3 text-xs text-[#374151]">{changeSentence(row.growth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-[#E8E0D4] px-5 py-4">
        <h2 className="text-sm font-bold text-[#1A1A1A]">این میز چه چیزی را عمداً نشان نمی‌دهد</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-[#6B7280]">
          موجودی، تیکت، پورسانت همکار و محتوای سایت خروجی فروش نیستند. عددشان روی میز خانه یا میز خودشان است تا این صفحه شلوغ و کند نشود.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {COVERAGE.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href === '/admin/orders' ? ordersHref : item.href}
                className={cn('inline-flex min-h-9 items-center rounded-full border border-[#E8E0D4] bg-white px-3 text-xs text-[#374151]', focusRing)}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { AdminChannelTabs, channelLabel, type AdminChannel } from './AdminChannelTabs';
import { sanitizeGa4Id, sanitizeGscToken } from '@/lib/google';

interface SummaryRow {
  articleId: string;
  title: string;
  slug: string;
  channel: string;
  pageViews: number;
  uniqueViews: number;
  scroll90: number;
  ctaClicks: number;
  productClicks: number;
  internalLinkClicks: number;
  views?: number;
}

interface SummaryResponse {
  totals: {
    pageViews: number;
    uniqueViews: number;
    ctaClicks: number;
    productClicks: number;
    scroll90: number;
  };
  items: SummaryRow[];
  integrations?: {
    ga4: { note: string; propertyHint: string };
    gsc: { note: string; propertyHint: string; metricsAvailable: boolean };
  };
}

export function AdminBlogAnalyticsPanel() {
  const [channel, setChannel] = useState<AdminChannel>('WHOLESALE');
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [ga4Id, setGa4Id] = useState('');
  const [gscToken, setGscToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [summary, settings] = await Promise.all([
        apiClient.get<SummaryResponse>(`/blog/admin/analytics/summary?channel=${channel}&limit=30`),
        apiClient.get<{ marketing?: Record<string, string> }>('/settings/admin').catch(() => null),
      ]);
      setData(summary);
      const m = settings?.marketing || {};
      setGa4Id(
        sanitizeGa4Id(channel === 'RETAIL' ? m.ga4RetailId : m.ga4WholesaleId),
      );
      setGscToken(
        sanitizeGscToken(
          channel === 'RETAIL' ? m.gscRetailVerification : m.gscWholesaleVerification,
        ),
      );
    } catch (err: unknown) {
      setData(null);
      setLoadError(err instanceof Error ? err.message : 'بارگذاری آمار ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    load();
  }, [load]);

  const t = data?.totals;
  const isEmpty = !loading && !loadError && (!!data && (data.items?.length ?? 0) === 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">آمار وبلاگ — {channelLabel(channel)}</h2>
          <p className="text-xs text-gray-500">view / scroll / CTA داخلی + وضعیت اتصال GA4 و توکن تأیید GSC (نه آنالیتیکس GSC)</p>
        </div>
        <AdminChannelTabs value={channel} onChange={setChannel} />
      </div>

      {loadError ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-800">خطا در بارگذاری آمار: {loadError}</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
            تلاش مجدد
          </button>
        </div>
      ) : null}

      {isEmpty ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
          هنوز رویدادی برای این کانال ثبت نشده است (حالت خالی معتبر).
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['بازدید صفحه', t?.pageViews],
          ['بازدید یکتا*', t?.uniqueViews],
          ['اسکرول ۹۰٪', t?.scroll90],
          ['کلیک CTA', t?.ctaClicks],
        ].map(([label, value]) => (
          <div key={String(label)} className="card p-4">
            <p className="text-[11px] text-gray-400">{label}</p>
            <p className="mt-1 text-xl font-extrabold text-gray-900">
              {loading ? '…' : loadError ? '—' : Number(value || 0).toLocaleString('fa-IR')}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400">
        * uniqueViews فقط وقتی کلاینت اولین بازدید نشست را با هدر x-blog-uv علامت بزند افزایش می‌یابد (نه کپی pageViews).
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card space-y-2 p-4 text-sm">
          <p className="font-bold">اتصال GA4</p>
          <p className={ga4Id ? 'text-green-700' : 'text-amber-700'}>
            {ga4Id ? `فعال — ${ga4Id}` : 'تنظیم نشده — از تنظیمات → Google مقدار G-… را وارد کنید'}
          </p>
          <p className="text-xs text-gray-500">{data?.integrations?.ga4.note}</p>
          <Link href="/admin/settings" className="text-xs text-primary hover:underline">
            رفتن به تنظیمات Google
          </Link>
        </div>
        <div className="card space-y-2 p-4 text-sm">
          <p className="font-bold">Search Console</p>
          <p className={gscToken ? 'text-green-700' : 'text-amber-700'}>
            {gscToken
              ? 'توکن تأیید ذخیره شده است'
              : 'توکن تأیید تنظیم نشده — از تنظیمات → Google'}
          </p>
          <p className="text-xs text-gray-500">{data?.integrations?.gsc.note}</p>
          <p className="text-[11px] text-gray-400">
            متریک‌های Click/Impression/CTR هنوز از API گوگل خوانده نمی‌شوند (hook آماده‌سازی‌شده).
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              {['عنوان', 'views', 'unique', 'scroll90', 'CTA', 'محصول', 'لینک داخلی'].map((h) => (
                <th key={h} className="px-3 py-2 text-right font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  در حال بارگذاری…
                </td>
              </tr>
            ) : !data?.items?.length ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  هنوز رویدادی ثبت نشده. بعد از بازدید مقالات، اینجا پر می‌شود.
                </td>
              </tr>
            ) : (
              data.items.map((row) => (
                <tr key={row.articleId} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <p className="line-clamp-1 font-semibold text-gray-900">{row.title}</p>
                    <p className="font-mono text-[10px] text-gray-400" dir="ltr">
                      /blog/{row.slug}
                    </p>
                  </td>
                  <td className="px-3 py-2">{Number(row.pageViews || 0).toLocaleString('fa-IR')}</td>
                  <td className="px-3 py-2">{Number(row.uniqueViews || 0).toLocaleString('fa-IR')}</td>
                  <td className="px-3 py-2">{Number(row.scroll90 || 0).toLocaleString('fa-IR')}</td>
                  <td className="px-3 py-2">{Number(row.ctaClicks || 0).toLocaleString('fa-IR')}</td>
                  <td className="px-3 py-2">{Number(row.productClicks || 0).toLocaleString('fa-IR')}</td>
                  <td className="px-3 py-2">
                    {Number(row.internalLinkClicks || 0).toLocaleString('fa-IR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

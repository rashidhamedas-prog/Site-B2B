'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { SmsSection, SmsStatusBadge } from './sms-ui';

export function AdminSmsDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.get('/admin/sms/reports/summary'),
      apiClient.get<any[]>('/admin/sms/campaigns').catch(() => []),
    ])
      .then(([s, c]) => {
        setSummary(s);
        setCampaigns(Array.isArray(c) ? c.filter((x) => ['SENDING', 'SCHEDULED', 'PAUSED'].includes(x.status)) : []);
      })
      .catch((e) => setError(e?.message || 'خطا در بارگذاری'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" aria-busy="true" />;
  }
  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error}{' '}
        <button type="button" className="underline" onClick={load}>
          تلاش مجدد
        </button>
      </div>
    );
  }
  if (!summary || (summary.sentToday === 0 && summary.queued === 0 && campaigns.length === 0)) {
    return (
      <SmsSection title="داشبورد پیامک">
        <p className="text-sm text-gray-600">هنوز پیامکی ارسال نشده</p>
        <Link href="/admin/sms/send" className="mt-3 inline-flex min-h-11 text-sm font-bold text-primary">
          ارسال تکی
        </Link>
      </SmsSection>
    );
  }

  const kpis = [
    { label: 'ارسال امروز', value: summary.sentToday },
    { label: 'تحویل امروز', value: summary.deliveredToday || 0 },
    { label: 'نرخ تحویل ۷ روز', value: `${Math.round((summary.deliveryRate7d || 0) * 100)}٪` },
    { label: 'در صف', value: summary.queued },
    { label: 'ناموفق', value: summary.failed },
    { label: 'لغوهای ثبت‌شده', value: summary.unsubscribes },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} tabIndex={0} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">{k.label}</div>
            <div className="mt-1 text-xl font-bold text-gray-900">
              {typeof k.value === 'number' ? k.value.toLocaleString('fa-IR') : k.value}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ['WHOLESALE', 'عمده'],
            ['WHOLESALE_REFERRAL', 'معرف عمده'],
            ['SALES_PARTNER', 'همکار فروش'],
            ['RETAIL', 'خرده‌فروشی'],
          ] as const
        ).map(([id, label]) => (
          <div key={id} className="rounded-2xl border border-gray-100 bg-white p-3 text-sm">
            <div className="text-gray-500">{label}</div>
            <div>ارسال {(summary.bySource?.[id]?.sent || 0).toLocaleString('fa-IR')}</div>
            <div>تحویل {(summary.bySource?.[id]?.delivered || 0).toLocaleString('fa-IR')}</div>
          </div>
        ))}
      </div>

      <SmsSection title="کمپین‌های فعال / زمان‌بندی‌شده">
        {campaigns.length === 0 ? (
          <p className="text-sm text-gray-500">موردی نیست</p>
        ) : (
          <div className="tablewrap overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-right text-gray-500">
                  <th className="p-2">نام</th>
                  <th className="p-2">وضعیت</th>
                  <th className="p-2">گیرنده</th>
                  <th className="p-2">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-gray-50">
                    <td className="p-2 font-medium">{c.name}</td>
                    <td className="p-2">
                      <SmsStatusBadge status={c.status} />
                    </td>
                    <td className="p-2 ltr text-left">{(c.recipientCount || 0).toLocaleString('fa-IR')}</td>
                    <td className="p-2">
                      <Link className="text-primary underline" href={`/admin/sms/campaigns/${c.id}`}>
                        مشاهده
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SmsSection>
    </div>
  );
}

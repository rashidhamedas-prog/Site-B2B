'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

type VendorStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED';

interface Me {
  id: string;
  name: string;
  phone: string;
  status: VendorStatus;
  acceptSlaHours: number;
  settlementHoldDays: number;
}

const STATUS_LABEL: Record<VendorStatus, string> = {
  INVITED: 'دعوت‌شده — با ورود فعال می‌شوید',
  ACTIVE: 'فعال',
  SUSPENDED: 'معلق',
};

export function PartnerHome() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<Me>('/partners/me')
      .then((row) => {
        if (!cancelled) setMe(row);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'بارگذاری حساب ناموفق بود');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-600">در حال بارگذاری حساب…</p>;
  }

  if (error || !me) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
        {error || 'حساب همکار پیدا نشد'}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{me.name}</h1>
        <p className="mt-1 text-sm text-gray-600" dir="ltr">
          {me.phone}
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <dt className="text-xs text-gray-500">وضعیت</dt>
          <dd className="mt-1 text-sm font-medium">{STATUS_LABEL[me.status]}</dd>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <dt className="text-xs text-gray-500">مهلت قبول سفارش</dt>
          <dd className="mt-1 text-sm font-medium">{me.acceptSlaHours} ساعت بعد از اطلاع</dd>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <dt className="text-xs text-gray-500">hold تسویه</dt>
          <dd className="mt-1 text-sm font-medium">{me.settlementHoldDays} روز بعد از تحویل</dd>
        </div>
      </dl>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-7 text-gray-700">
        <p>هنوز سفارشی برای ارسال اینجا نیست. وقتی مشتری از سایت ترنم بخرد، فقط ردیف‌های خودتان را می‌بینید.</p>
        <p className="mt-2">
          هزینه پست واقعی را خودتان می‌پردازید. مبلغ ارسال که مشتری در سبد می‌بیند برای ترنم است و به حساب همکار برنمی‌گردد.
        </p>
      </div>
    </div>
  );
}

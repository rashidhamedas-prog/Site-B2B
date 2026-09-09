'use client';

import { useCallback, useEffect, useState } from 'react';
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

type PartnerFulfillment = {
  id: string;
  parcelLabel: string;
  status: string;
  acceptBy: string | null;
  trackingCode: string | null;
  goodsTotal: number;
  commissionTotal: number;
  orderNumber: string | null;
  shippingAddress: string | null;
  shippingNote: string;
  items: Array<{
    productName: string;
    sku: string;
    color: string;
    size: string;
    quantity: number;
    lineTotal: number;
  }>;
};

const STATUS_LABEL: Record<VendorStatus, string> = {
  INVITED: 'دعوت‌شده — با ورود فعال می‌شوید',
  ACTIVE: 'فعال',
  SUSPENDED: 'معلق',
};

const FO_STATUS: Record<string, string> = {
  PENDING_ACCEPT: 'در انتظار قبول',
  ACCEPTED: 'قبول‌شده',
  REJECTED: 'ردشده',
  SHIPPED: 'ارسال‌شده',
  DELIVERED: 'تحویل',
  CANCELLED: 'لغو',
};

function toman(n: number) {
  return Math.round(Number(n) / 10).toLocaleString('fa-IR');
}

export function PartnerHome() {
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<PartnerFulfillment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [trackingDraft, setTrackingDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError('');
    try {
      const [profile, list] = await Promise.all([
        apiClient.get<Me>('/partners/me'),
        apiClient.get<{ data: PartnerFulfillment[] }>('/partners/fulfillments'),
      ]);
      setMe(profile);
      setRows(Array.isArray(list?.data) ? list.data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'بارگذاری حساب ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const accept = async (id: string) => {
    setBusyId(id);
    try {
      await apiClient.patch(`/partners/fulfillments/${id}/accept`, {});
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'قبول مرسوله ناموفق بود');
    } finally {
      setBusyId(null);
    }
  };

  const ship = async (id: string) => {
    setBusyId(id);
    try {
      await apiClient.patch(`/partners/fulfillments/${id}/ship`, {
        trackingCode: trackingDraft[id] || '',
      });
      setTrackingDraft((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'ثبت ارسال ناموفق بود');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-600">در حال بارگذاری حساب…</p>;
  }

  if (error && !me) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
        {error}
      </p>
    );
  }

  if (!me) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
        حساب همکار پیدا نشد
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

      <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-sm leading-7 text-amber-950">
        هزینه پست واقعی را خودتان می‌پردازید. مبلغ ارسال که مشتری در سبد می‌بیند برای ترنم است و به
        حساب همکار برنمی‌گردد.
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-bold text-gray-900">مرسوله‌های شما</h2>
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            هنوز سفارشی برای ارسال اینجا نیست. وقتی مشتری از سایت ترنم بخرد، فقط ردیف‌های خودتان را
            می‌بینید.
          </p>
        ) : (
          rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {row.parcelLabel}
                    {row.orderNumber ? ` · ${row.orderNumber}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {FO_STATUS[row.status] || row.status}
                    {row.acceptBy
                      ? ` · مهلت تا ${new Date(row.acceptBy).toLocaleString('fa-IR')}`
                      : ''}
                  </p>
                </div>
                {row.status === 'PENDING_ACCEPT' ? (
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void accept(row.id)}
                    className="min-h-11 rounded-xl bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {busyId === row.id ? '…' : 'قبول مرسوله'}
                  </button>
                ) : null}
              </div>
              {row.status === 'ACCEPTED' ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="flex-1 text-xs text-gray-600">
                    کد رهگیری پست
                    <input
                      dir="ltr"
                      className="mt-1 w-full min-h-11 rounded-xl border border-gray-200 px-3 text-sm"
                      value={trackingDraft[row.id] ?? ''}
                      onChange={(e) =>
                        setTrackingDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                      placeholder="مثلاً 1234567890"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void ship(row.id)}
                    className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {busyId === row.id ? '…' : 'ثبت ارسال'}
                  </button>
                </div>
              ) : null}
              {row.trackingCode ? (
                <p className="text-xs text-gray-600" dir="ltr">
                  tracking: {row.trackingCode}
                </p>
              ) : null}
              <ul className="space-y-1 text-sm text-gray-700">
                {row.items.map((it, i) => (
                  <li key={`${row.id}-${i}`}>
                    {it.productName} — {it.color}/{it.size} × {it.quantity} ({toman(it.lineTotal)} ت)
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                <span>کالا: {toman(row.goodsTotal)} ت</span>
                <span>کمیسیون ترنم: {toman(row.commissionTotal)} ت</span>
              </div>
              {row.shippingAddress ? (
                <p className="text-xs leading-6 text-gray-600 whitespace-pre-wrap">{row.shippingAddress}</p>
              ) : null}
              <p className="text-xs text-gray-500">{row.shippingNote}</p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

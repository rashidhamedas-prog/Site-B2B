'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { orderStatusLabelFa, customerChannelLabelFa, customerStatusLabelFa } from '@taranom/shared-types';
import { apiClient } from '@/lib/api';
import { useCustomer } from '@/lib/hooks/useCustomers';
import {
  CUSTOMER_RECORD_TABS,
  CUSTOMER_RECORD_TAB_LABEL,
  parseCustomerWorkspaceQuery,
  serializeCustomerWorkspaceQuery,
} from '@/lib/admin-customer-workspace';
import { orderDeliveryAddresses } from '@/lib/order-admin-snapshot';
import { AdminCustomerDossier } from './customer-marketing/AdminCustomerDossier';
import { AdminCustomerWallet } from './AdminCustomerWallet';
import { cn } from '@/lib/cn';

function toman(n: number) {
  return Math.round(Number(n) / 10).toLocaleString('fa-IR');
}

export function AdminCustomerRecord() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parsed = parseCustomerWorkspaceQuery(searchParams);
  const { customer, loading, error, reload } = useCustomer(id);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    businessName: '', ownerName: '', phone: '', phone2: '', email: '',
    province: '', city: '', address: '', postalCode: '', nationalId: '',
    type: 'B2B', businessType: 'WHOLESALE', segment: 'C', status: 'PENDING',
    creditLimit: '', notes: '',
  });
  const [orders, setOrders] = useState<Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    createdAt: string;
    shippingAddress?: string | Record<string, unknown> | null;
  }>>([]);

  useEffect(() => {
    if (!customer) return;
    setForm({
      businessName: customer.businessName,
      ownerName: customer.ownerName,
      phone: customer.phone,
      phone2: customer.phone2 ?? '',
      email: customer.email ?? '',
      province: customer.province,
      city: customer.city,
      address: customer.address ?? '',
      postalCode: customer.postalCode ?? '',
      nationalId: customer.nationalId ?? '',
      type: customer.type === 'B2C' || customer.type === 'RETAIL' ? 'B2C' : 'B2B',
      businessType: customer.businessType || 'WHOLESALE',
      segment: customer.segment,
      status: customer.status,
      creditLimit: customer.creditLimit ? String(Number(customer.creditLimit) / 10) : '',
      notes: customer.notes ?? '',
    });
  }, [customer]);

  useEffect(() => {
    if (!id) return;
    apiClient
      .get<{ data: Array<{
        id: string;
        orderNumber: string;
        status: string;
        total: number;
        createdAt: string;
        shippingAddress?: string | Record<string, unknown> | null;
      }> }>(
        `/orders?customerId=${encodeURIComponent(id)}&limit=20`,
      )
      .then((res) => setOrders(res.data || []))
      .catch(() => setOrders([]));
  }, [id]);

  const setTab = (tab: typeof parsed.tab) => {
    const qs = serializeCustomerWorkspaceQuery({ ...parsed, tab });
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const saveIdentity = useCallback(async () => {
    setSaving(true);
    setNotice('');
    try {
      await apiClient.patch(`/customers/${id}`, {
        ...form,
        creditLimit: form.creditLimit ? Number(form.creditLimit) * 10 : 0,
      });
      await reload();
      setNotice('ذخیره شد');
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'ذخیره نشد');
    } finally {
      setSaving(false);
    }
  }, [form, id, reload]);

  if (loading) return <p className="text-sm text-gray-500">در حال بارگذاری پرونده…</p>;
  if (error || !customer) {
    return (
      <p className="text-sm text-red-600">
        {error || 'مشتری یافت نشد'} <Link href="/admin/customers" className="underline">بازگشت</Link>
      </p>
    );
  }

  const listQs = serializeCustomerWorkspaceQuery({ ...parsed, tab: 'identity' });
  const deliveryAddresses = orderDeliveryAddresses(orders);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">
            <Link href={`/admin/customers${listQs ? `?${listQs}` : ''}`} className="hover:underline">فهرست مشتریان</Link>
            {' / '}
            <Link href={`/admin/customers/marketing?${serializeCustomerWorkspaceQuery({ channel: parsed.channel === 'ALL' ? customer.channel || 'RETAIL' : parsed.channel })}`} className="hover:underline">بازاریابی</Link>
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">{customer.businessName}</h2>
          <p className="text-sm text-gray-500">
            {customer.ownerName} · {customer.city} · {customer.code} · کیف پول {toman(customer.balance)} ت
          </p>
        </div>
        <span className={cn(
          'rounded-full px-3 py-1 text-xs font-semibold',
          customer.channel === 'RETAIL' ? 'bg-amber-100 text-amber-800' : 'bg-[#1B5C4A]/10 text-[#1B5C4A]',
        )}>
          {customerChannelLabelFa(customer.channel)} · {customerStatusLabelFa(customer.status)}
        </span>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1" role="tablist" aria-label="بخش‌های پرونده مشتری">
        {CUSTOMER_RECORD_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={parsed.tab === tab}
            onClick={() => setTab(tab)}
            className={cn(
              'min-h-11 rounded-lg px-3 text-xs font-semibold',
              parsed.tab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
            )}
          >
            {CUSTOMER_RECORD_TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      {parsed.tab === 'identity' && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4">
          {notice ? <p className="text-sm text-gray-600">{notice}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ['businessName', 'نام مجموعه'],
              ['ownerName', 'نام صاحب'],
              ['phone', 'موبایل'],
              ['phone2', 'موبایل دوم'],
              ['email', 'ایمیل'],
              ['nationalId', 'کد ملی'],
              ['province', 'استان'],
              ['city', 'شهر'],
              ['postalCode', 'کد پستی'],
              ['creditLimit', 'سقف اعتبار (تومان)'],
            ] as const).map(([key, label]) => (
              <label key={key} className="text-xs text-gray-600">
                {label}
                <input
                  value={form[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
            ))}
          </div>
          <label className="block text-xs text-gray-600">
            آدرس اصلی
            <input
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs text-gray-600">کانال
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm">
                <option value="B2B">عمده</option>
                <option value="B2C">تکی</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">نوع کسب
              <select value={form.businessType} onChange={(e) => setForm((p) => ({ ...p, businessType: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm">
                <option value="WHOLESALE">عمده‌فروش</option>
                <option value="RETAIL">خرده‌فروش</option>
                <option value="ONLINE">آنلاین</option>
                <option value="BOUTIQUE">بوتیک</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">سگمنت
              <select value={form.segment} onChange={(e) => setForm((p) => ({ ...p, segment: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm">
                <option>VIP</option><option>A</option><option>B</option><option>C</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">وضعیت
              <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm">
                <option value="PENDING">در انتظار تأیید</option>
                <option value="ACTIVE">فعال</option>
                <option value="INACTIVE">غیرفعال</option>
              </select>
            </label>
          </div>
          <label className="block text-xs text-gray-600">
            یادداشت داخلی
            <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={3} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <button type="button" disabled={saving} onClick={() => void saveIdentity()} className="btn btn-primary btn-sm min-h-11">
            {saving ? 'در حال ذخیره…' : 'ذخیره هویت'}
          </button>
        </section>
      )}

      {parsed.tab === 'addresses' && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
          <h3 className="text-sm font-bold">آدرس ارسال سفارش‌ها</h3>
          {deliveryAddresses.length === 0 ? (
            <p className="text-sm text-gray-400">روی سفارش‌های این مشتری آدرس ارسالی ثبت نشده است.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {deliveryAddresses.map((row) => (
                <li key={`${row.orderId}-${row.postalCode}`} className="rounded-xl border border-gray-100 p-3">
                  <p className="font-semibold">
                    {row.name || 'گیرنده'}
                    {row.orderNumber ? (
                      <>
                        {' · '}
                        <Link href={`/admin/orders/${row.orderId}`} className="font-mono text-xs text-primary hover:underline">{row.orderNumber}</Link>
                      </>
                    ) : null}
                  </p>
                  <p className="text-gray-600 leading-6">{row.address}</p>
                  {row.postalCode ? <p className="text-xs text-gray-500">کد پستی <span className="font-mono dir-ltr">{row.postalCode}</span></p> : null}
                  {row.phone ? <p className="font-mono text-xs dir-ltr text-right">{row.phone}</p> : null}
                </li>
              ))}
            </ul>
          )}
          <h3 className="pt-3 text-sm font-bold">آدرس اصلی پرونده</h3>
          <p className="text-sm text-gray-600">{customer.address || 'ثبت نشده'} — {customer.city}، {customer.province} {customer.postalCode || ''}</p>
          <h3 className="pt-3 text-sm font-bold">دفترچه آدرس ذخیره‌شده</h3>
          {(customer.savedAddresses || []).length === 0 ? (
            <p className="text-sm text-gray-400">دفترچه آدرس هنوز ذخیره نشده است.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(customer.savedAddresses || []).map((a) => (
                <li key={a.id} className="rounded-xl border border-gray-100 p-3">
                  <p className="font-semibold">{a.recipient} {a.isDefault ? '· پیش‌فرض' : ''}</p>
                  <p className="text-gray-600">{a.street} — {a.city}، {a.province}</p>
                  <p className="font-mono text-xs dir-ltr">{a.mobile}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {parsed.tab === 'orders' && (
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          {orders.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">سفارشی برای این مشتری نیست.</p>
          ) : (
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-3 py-2 text-right">شماره</th>
                  <th className="px-3 py-2 text-right">وضعیت</th>
                  <th className="px-3 py-2 text-right">مبلغ</th>
                  <th className="px-3 py-2 text-right">تاریخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-3 py-2">
                      <Link href={`/admin/orders/${o.id}`} className="font-mono text-primary hover:underline">{o.orderNumber}</Link>
                    </td>
                    <td className="px-3 py-2">{orderStatusLabelFa(o.status)}</td>
                    <td className="px-3 py-2">{toman(o.total)} ت</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString('fa-IR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {parsed.tab === 'wallet' && <AdminCustomerWallet customerId={id} />}
      {parsed.tab === 'marketing' && <AdminCustomerDossier embedded />}
    </div>
  );
}

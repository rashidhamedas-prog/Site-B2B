'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Truck, CheckCircle, XCircle, Clock, Package, MapPin, Save } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { OrderStatusBadge } from '@/components/ui';
import { cn } from '@/lib/cn';

interface OrderItem {
  id: string;
  productName: string;
  sku: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  type: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
  shippingMethod: string;
  shippingAddress?: string;
  trackingCode?: string;
  notes?: string;
  confirmedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  items: OrderItem[];
  customer?: { id: string; businessName: string; ownerName: string; phone: string; city: string; province: string; segment: string };
}

function toman(n: number) { return Math.round(Number(n) / 10).toLocaleString('fa-IR'); }

const SHIP_METHODS = [
  { id: 'CHAPAR', label: 'چاپار' },
  { id: 'TIPAX', label: 'تیپاکس' },
  { id: 'SNAPP', label: 'اسنپ‌باکس (درون‌شهری مشهد)' },
  { id: 'POST', label: 'پست پیشتاز' },
  { id: 'FREIGHT', label: 'باربری (سفارش حجمی)' },
];

function trackingLink(method: string, code: string): string {
  const urls: Record<string, string> = {
    CHAPAR: `https://chaparapp.ir/tracking/${code}`,
    POST: `https://tracking.post.ir/?id=${code}`,
    TIPAX: `https://tipaxco.com/tracking?code=${code}`,
    SNAPP: `https://box.snapp.ir/tracking/${code}`,
  };
  return urls[method] ?? urls.CHAPAR;
}

const STATUS_FLOW = [
  { key: 'PENDING_REVIEW', label: 'در انتظار بررسی', icon: Clock },
  { key: 'PROCESSING',     label: 'در حال پردازش',   icon: Package },
  { key: 'CONFIRMED',      label: 'تأیید شده',        icon: CheckCircle },
  { key: 'SHIPPED',        label: 'ارسال شده',        icon: Truck },
  { key: 'DELIVERED',      label: 'تحویل داده شده',   icon: CheckCircle },
  { key: 'COMPLETED',      label: 'تکمیل شده',        icon: CheckCircle },
];

export function AdminOrderDetail({ id }: { id: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackingCode, setTrackingCode] = useState('');
  const [shipMethod, setShipMethod] = useState('CHAPAR');
  const [savingTracking, setSavingTracking] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    apiClient.get<Order>(`/orders/${id}`)
      .then((data) => {
        setOrder(data);
        setTrackingCode(data.trackingCode ?? '');
        setShipMethod(data.shippingMethod ?? 'CHAPAR');
      })
      .catch(() => router.push('/admin/orders'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const updateStatus = async (status: string) => {
    if (!order) return;
    setUpdatingStatus(true);
    try {
      const updated = await apiClient.patch<Order>(`/orders/${order.id}/status`, { status });
      setOrder(updated);
    } catch {} finally { setUpdatingStatus(false); }
  };

  const saveTracking = async () => {
    if (!order || !trackingCode) return;
    setSavingTracking(true);
    try {
      const updated = await apiClient.patch<Order>(`/orders/${order.id}/tracking`, {
        trackingCode,
        shippingMethod: shipMethod,
      });
      setOrder(updated);
    } catch {} finally { setSavingTracking(false); }
  };

  if (loading) return <div className="p-8"><div className="skeleton h-64 rounded-2xl" /></div>;
  if (!order) return null;

  const currentStepIdx = STATUS_FLOW.findIndex((s) => s.key === order.status);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/orders" className="text-gray-400 hover:text-primary">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">{order.orderNumber}</h2>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString('fa-IR', { dateStyle: 'long' })}</p>
        </div>
      </div>

      {/* Status timeline */}
      <div className="card p-5">
        <div className="flex items-center gap-0">
          {STATUS_FLOW.map((s, i) => {
            const done = i < currentStepIdx;
            const active = i === currentStepIdx;
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div className={cn('flex flex-col items-center', i < STATUS_FLOW.length - 1 ? 'flex-1' : '')}>
                  <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                    done ? 'bg-success border-success text-white' : active ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-gray-400')}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <p className={cn('text-[10px] mt-1 text-center hidden sm:block', active ? 'text-primary font-bold' : done ? 'text-success' : 'text-gray-400')}>
                    {s.label}
                  </p>
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <div className={cn('h-0.5 flex-1 mx-1', done ? 'bg-success' : 'bg-gray-100')} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">اقلام سفارش</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50">
                <tr>{['محصول', 'رنگ/سایز', 'تعداد', 'قیمت واحد', 'جمع'].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.items.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">اقلامی ثبت نشده</td></tr>
                ) : order.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">{item.productName}</p>
                      <p className="text-xs text-gray-400 font-mono">{item.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.color} / {item.size}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{toman(item.unitPrice)} ت</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">{toman(item.totalPrice)} ت</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Totals */}
          <div className="px-5 py-4 border-t border-gray-100 space-y-2">
            {[
              { label: 'جمع اقلام', value: toman(order.subtotal) },
              { label: 'تخفیف', value: `-${toman(order.discount)}`, hide: Number(order.discount) === 0 },
              { label: 'هزینه ارسال', value: Number(order.shippingFee) === 0 ? 'رایگان' : `${toman(order.shippingFee)} ت` },
            ].filter((r) => !r.hide).map((r) => (
              <div key={r.label} className="flex justify-between text-sm">
                <span className="text-gray-500">{r.label}</span>
                <span className="text-gray-700">{r.value} {r.label === 'جمع اقلام' ? 'ت' : ''}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2">
              <span>مجموع کل</span>
              <span className="text-primary">{toman(order.total)} تومان</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Customer */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />اطلاعات مشتری
            </h3>
            {order.customer ? (
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-gray-900">{order.customer.businessName}</p>
                <p className="text-gray-500">{order.customer.ownerName}</p>
                <p className="text-gray-500">{order.customer.phone}</p>
                <p className="text-gray-500">{order.customer.city}، {order.customer.province}</p>
                <Link href={`/admin/customers`} className="text-xs text-primary hover:underline block mt-2">مشاهده پروفایل</Link>
              </div>
            ) : <p className="text-sm text-gray-400">اطلاعات مشتری موجود نیست</p>}
          </div>

          {/* Shipping */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />ارسال
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">روش ارسال</span>
                <span>{SHIP_METHODS.find((m) => m.id === order.shippingMethod)?.label ?? order.shippingMethod}</span>
              </div>
              <div className="flex justify-between"><span className="text-gray-500">روش پرداخت</span><span>{order.paymentMethod}</span></div>
              {order.trackingCode && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">کد پیگیری</span>
                  <a
                    href={trackingLink(order.shippingMethod, order.trackingCode)}
                    target="_blank" rel="noopener noreferrer"
                    className="font-mono text-xs text-primary hover:underline"
                    title="رهگیری مرسوله"
                  >{order.trackingCode}</a>
                </div>
              )}
            </div>
            {/* Ship: method + tracking input */}
            {['CONFIRMED', 'PROCESSING'].includes(order.status) && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <label className="block text-xs font-medium text-gray-600">ارسال مرسوله</label>
                <select value={shipMethod} onChange={(e) => setShipMethod(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30">
                  {SHIP_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <div className="flex gap-2">
                  <input value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)}
                    placeholder="کد پیگیری — مثلاً: 1234567890"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  <button onClick={saveTracking} disabled={savingTracking || !trackingCode}
                    className="btn btn-primary btn-sm">
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {order.status === 'PENDING_REVIEW' && (
            <div className="card p-5 space-y-2">
              <h3 className="font-bold text-gray-900 text-sm mb-3">اقدامات</h3>
              <button onClick={() => updateStatus('PROCESSING')} disabled={updatingStatus}
                className="w-full btn btn-primary btn-md flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4" />تأیید و پردازش
              </button>
              <button onClick={() => updateStatus('CANCELLED')} disabled={updatingStatus}
                className="w-full btn btn-md border border-error text-error hover:bg-red-50 flex items-center justify-center gap-2">
                <XCircle className="h-4 w-4" />رد سفارش
              </button>
            </div>
          )}
          {order.status === 'PROCESSING' && (
            <button onClick={() => updateStatus('CONFIRMED')} disabled={updatingStatus}
              className="w-full btn btn-primary btn-md flex items-center justify-center gap-2 card p-5">
              <CheckCircle className="h-4 w-4" />تأیید نهایی
            </button>
          )}
          {order.status === 'SHIPPED' && (
            <button onClick={() => updateStatus('DELIVERED')} disabled={updatingStatus}
              className="w-full btn btn-primary btn-md flex items-center justify-center gap-2 card p-5">
              <Truck className="h-4 w-4" />تحویل داده شد
            </button>
          )}
          {order.notes && (
            <div className="card p-4 bg-amber-50 border-amber-200">
              <p className="text-xs font-medium text-amber-700 mb-1">یادداشت مشتری</p>
              <p className="text-sm text-amber-800">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

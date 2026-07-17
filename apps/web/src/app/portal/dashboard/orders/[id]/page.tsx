'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { OrderStatusBadge } from '@/components/ui';
import { cn } from '@/lib/cn';

interface OrderItem { id: string; productName: string; sku: string; color: string; size: string; quantity: number; unitPrice: number; totalPrice: number; }
interface Order {
  id: string; orderNumber: string; status: string; subtotal: number; discount: number;
  shippingFee: number; total: number; paymentMethod: string; shippingMethod: string;
  trackingCode?: string; freightCost?: number; freightReceiptUrl?: string;
  notes?: string; createdAt: string; items: OrderItem[];
}

function toman(n: number) { return Math.round(Number(n) / 10).toLocaleString('fa-IR'); }

const STATUS_FLOW = [
  { key: 'PENDING_REVIEW', label: 'در انتظار بررسی', icon: Clock },
  { key: 'PROCESSING',     label: 'پردازش',           icon: Package },
  { key: 'CONFIRMED',      label: 'تأیید شده',        icon: CheckCircle },
  { key: 'SHIPPED',        label: 'ارسال شده',        icon: Truck },
  { key: 'DELIVERED',      label: 'تحویل داده شده',   icon: CheckCircle },
];

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<Order>(`/orders/${id}`)
      .then(setOrder)
      .catch(() => router.push('/portal/dashboard/orders'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <div className="p-8"><div className="skeleton h-64 rounded-2xl" /></div>;
  if (!order) return null;

  const currentIdx = STATUS_FLOW.findIndex((s) => s.key === order.status);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/portal/dashboard/orders" className="text-gray-400 hover:text-primary">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">{order.orderNumber}</h2>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString('fa-IR', { dateStyle: 'long' })}</p>
        </div>
      </div>

      {/* Status */}
      <div className="card p-5">
        <div className="flex items-center gap-0">
          {STATUS_FLOW.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div className={cn('flex flex-col items-center', i < STATUS_FLOW.length - 1 ? 'flex-1' : '')}>
                  <div className={cn('h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all',
                    done ? 'bg-success border-success text-white' : active ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-gray-400')}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <p className={cn('text-[10px] mt-1 text-center hidden sm:block whitespace-nowrap',
                    active ? 'text-primary font-bold' : done ? 'text-success' : 'text-gray-400')}>{s.label}</p>
                </div>
                {i < STATUS_FLOW.length - 1 && <div className={cn('h-0.5 flex-1 mx-1', done ? 'bg-success' : 'bg-gray-100')} />}
              </div>
            );
          })}
        </div>
        {(order.trackingCode || order.freightCost || order.freightReceiptUrl) && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-sm">
            {order.trackingCode && (
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <span className="text-gray-600">کد پیگیری ارسال:</span>
                <span className="font-mono font-bold text-gray-900">{order.trackingCode}</span>
              </div>
            )}
            {!!order.freightCost && (
              <p className="text-gray-600">هزینه باربری: <span className="font-bold text-gray-900">{toman(Number(order.freightCost))} تومان</span></p>
            )}
            {order.freightReceiptUrl && (
              <a href={order.freightReceiptUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">
                مشاهده رسید باربری
              </a>
            )}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-bold text-gray-900">اقلام سفارش</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px]">
            <thead className="bg-gray-50">
              <tr>{['محصول', 'رنگ/سایز', 'تعداد', 'جمع'].map((h) => (
                <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {order.items.length === 0
                ? <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">اقلامی ثبت نشده</td></tr>
                : order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold">{item.productName}</p>
                      <p className="text-xs text-gray-400 font-mono">{item.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.color} / {item.size}</td>
                    <td className="px-4 py-3 text-sm font-bold">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm font-bold whitespace-nowrap">{toman(item.totalPrice)} ت</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 space-y-1.5">
          <div className="flex justify-between text-sm"><span className="text-gray-500">هزینه ارسال</span><span>{Number(order.shippingFee) === 0 ? 'رایگان' : `${toman(order.shippingFee)} ت`}</span></div>
          <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2">
            <span>مجموع کل</span><span className="text-primary">{toman(order.total)} تومان</span>
          </div>
        </div>
      </div>

      {order.notes && (
        <div className="card p-4 bg-amber-50 border border-amber-200">
          <p className="text-xs font-medium text-amber-700 mb-1">یادداشت</p>
          <p className="text-sm text-amber-800">{order.notes}</p>
        </div>
      )}
    </div>
  );
}

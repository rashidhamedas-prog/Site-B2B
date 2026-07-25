'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, CheckCircle, XCircle, Trash2, Pencil } from 'lucide-react';
import { OrderStatusBadge, Pagination } from '@/components/ui';
import { useOrders } from '@/lib/hooks/useOrders';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

const STATUS_FILTERS = ['همه', 'PENDING_REVIEW', 'PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DELETED'];
const STATUS_FA: Record<string, string> = {
  PENDING_REVIEW: 'در انتظار بررسی', PROCESSING: 'در حال پردازش', CONFIRMED: 'تأیید شده',
  SHIPPED: 'ارسال شده', DELIVERED: 'تحویل داده شده', COMPLETED: 'تکمیل شده',
  CANCELLED: 'لغو شده', DELETED: 'حذف‌شده',
};

const CHANNEL_FILTERS = [
  { id: '', label: 'همه کانال‌ها' },
  { id: 'WHOLESALE', label: 'عمده' },
  { id: 'RETAIL_WEBSITE', label: 'تکی (.ir)' },
];

export function AdminOrders() {
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { orders, meta, loading, refetch } = useOrders({
    page,
    status: status || undefined,
    type: type || undefined,
  });

  const updateStatus = async (id: string, newStatus: string) => {
    setBusyId(id);
    try {
      await apiClient.patch(`/orders/${id}/status`, { status: newStatus });
      refetch();
    } catch (e: any) {
      alert(e?.message || 'خطا در تغییر وضعیت');
    } finally {
      setBusyId(null);
    }
  };

  const voidOrder = async (id: string, orderNumber: string) => {
    if (!confirm(`سفارش ${orderNumber} حذف شود؟\nموجودی برمی‌گردد، کیف‌پول/تخفیف معکوس می‌شود، ولی ردیف برای مشاهده جزئیات می‌ماند.`)) {
      return;
    }
    setBusyId(id);
    try {
      await apiClient.delete(`/orders/${id}`, { reason: 'حذف از پنل ادمین' });
      refetch();
    } catch (e: any) {
      alert(e?.message || 'خطا در حذف سفارش');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">سفارش‌ها</h2>
          <p className="text-sm text-gray-500 mt-0.5">{meta.total} سفارش</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CHANNEL_FILTERS.map((c) => (
          <button
            key={c.id || 'all-ch'}
            onClick={() => { setType(c.id); setPage(1); }}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
              type === c.id ? 'bg-secondary text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s === 'همه' ? '' : s); setPage(1); }}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
              (s === 'همه' ? status === '' : status === s) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {s === 'همه' ? 'همه' : STATUS_FA[s]}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['شماره سفارش', 'کانال', 'تاریخ', 'تعداد', 'مبلغ', 'وضعیت', 'عملیات'].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-24" /></td>
                  ))}</tr>
                ))
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">سفارشی یافت نشد</td></tr>
              ) : orders.map((order) => {
                const deleted = order.status === 'DELETED';
                return (
                <tr key={order.id} className={cn('hover:bg-gray-50 transition-colors', deleted && 'bg-red-50/40 opacity-80')}>
                  <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900">{order.orderNumber}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold',
                      order.type === 'RETAIL_WEBSITE' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800',
                    )}>
                      {order.type === 'RETAIL_WEBSITE' ? 'تکی' : 'عمده'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(order.createdAt).toLocaleDateString('fa-IR')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{order.items?.length ?? 0} قلم</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">
                    {(Number(order.total) / 10).toLocaleString('fa-IR')} ت
                  </td>
                  <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {order.status === 'PENDING_REVIEW' && (
                        <>
                          <button
                            disabled={busyId === order.id}
                            onClick={() => updateStatus(order.id, 'CONFIRMED')}
                            className="text-success hover:opacity-80"
                            title="تأیید"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button
                            disabled={busyId === order.id}
                            onClick={() => updateStatus(order.id, 'CANCELLED')}
                            className="text-error hover:opacity-80"
                            title="لغو"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {!deleted && (
                        <>
                          <Link href={`/admin/orders/${order.id}?edit=1`} className="text-gray-400 hover:text-primary" title="ویرایش">
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            disabled={busyId === order.id}
                            onClick={() => voidOrder(order.id, order.orderNumber)}
                            className="text-gray-400 hover:text-error"
                            title="حذف (با بازگشت موجودی)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <Link href={`/admin/orders/${order.id}`} className="text-gray-400 hover:text-primary" title="جزئیات">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
        <div className="px-4 border-t border-gray-100">
          <Pagination page={page} totalPages={meta.totalPages} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}

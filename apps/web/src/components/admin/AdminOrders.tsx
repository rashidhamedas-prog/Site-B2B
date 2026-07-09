'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Eye, CheckCircle, XCircle } from 'lucide-react';
import { Input, OrderStatusBadge, Pagination } from '@/components/ui';
import { useOrders } from '@/lib/hooks/useOrders';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

const STATUS_FILTERS = ['همه', 'PENDING_REVIEW', 'PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED'];
const STATUS_FA: Record<string, string> = {
  PENDING_REVIEW: 'در انتظار بررسی', PROCESSING: 'در حال پردازش', CONFIRMED: 'تأیید شده',
  SHIPPED: 'ارسال شده', DELIVERED: 'تحویل داده شده', COMPLETED: 'تکمیل شده',
};

export function AdminOrders() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { orders, meta, loading, refetch } = useOrders({ page, status: status || undefined });

  const updateStatus = async (id: string, newStatus: string) => {
    await apiClient.patch(`/orders/${id}/status`, { status: newStatus });
    refetch();
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
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['شماره سفارش', 'تاریخ', 'تعداد', 'مبلغ', 'وضعیت', 'عملیات'].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-24" /></td>
                  ))}</tr>
                ))
              ) : orders.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">سفارشی یافت نشد</td></tr>
              ) : orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900">{order.orderNumber}</td>
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
                          <button onClick={() => updateStatus(order.id, 'CONFIRMED')} className="text-success hover:opacity-80" title="تأیید">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button onClick={() => updateStatus(order.id, 'CANCELLED')} className="text-error hover:opacity-80" title="رد">
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <Link href={`/admin/orders/${order.id}`} className="text-gray-400 hover:text-primary">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
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

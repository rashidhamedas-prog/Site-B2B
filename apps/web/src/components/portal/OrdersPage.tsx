'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { OrderStatusBadge, Pagination } from '@/components/ui';
import { useOrders } from '@/lib/hooks/useOrders';

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const { orders, meta, loading } = useOrders({ page });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-bold text-gray-900">سفارش‌های من</h2>
        <Link href="/products" className="btn btn-primary btn-md">+ سفارش جدید</Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['شماره سفارش', 'تاریخ', 'تعداد', 'مبلغ', 'وضعیت', 'کد رهگیری', 'جزئیات'].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-20" /></td>
                  ))}</tr>
                ))
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">هنوز سفارشی ثبت نکرده‌اید</td></tr>
              ) : orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(order.createdAt).toLocaleDateString('fa-IR')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{order.items?.length ?? 0} کالا</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">
                    {(Number(order.total) / 10).toLocaleString('fa-IR')} تومان
                  </td>
                  <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{order.trackingCode || '—'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/portal/dashboard/orders/${order.id}`} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                      <Eye className="h-3.5 w-3.5" />جزئیات
                    </Link>
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

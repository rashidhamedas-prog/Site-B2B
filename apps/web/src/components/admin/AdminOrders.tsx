'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Eye, CheckCircle, XCircle, Trash2, Pencil, Package, Truck } from 'lucide-react';
import {
  ADMIN_ORDER_QUEUES,
  adminQueueActions,
  adminQueueHint,
  emptyQueueCopy,
  isAdminOrderQueue,
  orderStatusLabelFa,
} from '@taranom/shared-types';
import { OrderStatusBadge, Pagination } from '@/components/ui';
import { useOrderStatusCounts, useOrders } from '@/lib/hooks/useOrders';
import { apiClient } from '@/lib/api';
import { asPaymentRows, describeSettlement, recipientSnapshot, type PaymentRow } from '@/lib/order-admin-snapshot';
import { cn } from '@/lib/cn';
import { AdminChannelFilter, type AdminChannel } from './AdminChannelTabs';
import { AdminPackingSlipButton } from './AdminPackingSlip';

const ACTION_ICON: Record<string, typeof CheckCircle> = {
  CONFIRMED: CheckCircle,
  PROCESSING: Package,
  DELIVERED: Truck,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
};

function channelToOrderType(ch: AdminChannel | 'ALL'): string {
  if (ch === 'WHOLESALE') return 'WHOLESALE';
  if (ch === 'RETAIL') return 'RETAIL_WEBSITE';
  return '';
}

function parseChannel(raw: string | null): AdminChannel | 'ALL' {
  if (raw === 'WHOLESALE' || raw === 'RETAIL') return raw;
  return 'ALL';
}

function customerLabel(order: Parameters<typeof recipientSnapshot>[0]): string {
  return recipientSnapshot(order).name || '—';
}

function customerPhone(order: Parameters<typeof recipientSnapshot>[0]): string {
  return recipientSnapshot(order).phone;
}

function AdminOrdersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get('status') || '';
  const status = isAdminOrderQueue(statusParam) ? statusParam : '';
  const channelFilter = parseChannel(searchParams.get('channel'));
  const page = Math.max(1, Number(searchParams.get('page') || 1) || 1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const type = channelToOrderType(channelFilter);
  const { orders, meta, loading, refetch } = useOrders({
    page,
    status: status || undefined,
    type: type || undefined,
  });
  const { counts, refetch: refetchCounts } = useOrderStatusCounts(type || undefined);

  const replaceQuery = (next: { status?: string; channel?: AdminChannel | 'ALL'; page?: number }) => {
    const q = new URLSearchParams();
    const nextStatus = next.status === undefined ? status : next.status;
    const nextChannel = next.channel === undefined ? channelFilter : next.channel;
    const nextPage = next.page === undefined ? 1 : next.page;
    if (nextStatus) q.set('status', nextStatus);
    if (nextChannel !== 'ALL') q.set('channel', nextChannel);
    if (nextPage > 1) q.set('page', String(nextPage));
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    apiClient.get<unknown>('/payments').then((rows) => setPayments(asPaymentRows(rows))).catch(() => setPayments([]));
  }, []);

  useEffect(() => {
    if (statusParam && !isAdminOrderQueue(statusParam)) {
      replaceQuery({ status: '', page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusParam]);

  const refresh = () => {
    refetch();
    refetchCounts();
  };

  const updateStatus = async (id: string, newStatus: string, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusyId(id);
    try {
      await apiClient.patch(`/orders/${id}/status`, { status: newStatus });
      refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در تغییر وضعیت');
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
      refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در حذف سفارش');
    } finally {
      setBusyId(null);
    }
  };

  const tabs = useMemo(
    () => [{ key: '', label: 'همه' }, ...ADMIN_ORDER_QUEUES.map((key) => ({ key, label: orderStatusLabelFa(key) }))],
    [],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">سفارش‌ها</h2>
          <p className="text-sm text-gray-500 mt-0.5">{meta.total.toLocaleString('fa-IR')} سفارش در این صف</p>
        </div>
      </div>

      <AdminChannelFilter
        value={channelFilter}
        onChange={(v) => replaceQuery({ channel: v, page: 1 })}
      />

      <div
        role="tablist"
        aria-label="صف وضعیت سفارش"
        className="flex flex-wrap gap-1.5"
      >
        {tabs.map((tab) => {
          const selected = tab.key === status;
          const count = tab.key === '' ? counts.ALL : counts[tab.key];
          return (
            <button
              key={tab.key || 'ALL'}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => replaceQuery({ status: tab.key, page: 1 })}
              className={cn(
                'cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                'transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                selected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {tab.label}
              <span className={cn(
                'min-w-4 rounded-full px-1.5 text-[10px] tabular-nums',
                selected ? 'bg-white/20 text-white' : 'bg-white text-gray-500',
              )}>
                {(count ?? 0).toLocaleString('fa-IR')}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 leading-6">{adminQueueHint(status)}</p>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['شماره سفارش', 'مشتری', 'کانال', 'پرداخت', 'تاریخ', 'تعداد', 'مبلغ', 'وضعیت', 'عملیات'].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-24" /></td>
                  ))}</tr>
                ))
              ) : orders.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">{emptyQueueCopy(status)}</td></tr>
              ) : orders.map((order) => {
                const deleted = order.status === 'DELETED';
                const actions = adminQueueActions(order.status);
                const settlement = describeSettlement({
                  paymentMethod: order.paymentMethod,
                  payments,
                  orderId: order.id,
                });
                return (
                <tr key={order.id} className={cn('hover:bg-gray-50 transition-colors', deleted && 'bg-red-50/40 opacity-80')}>
                  <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 min-w-0">
                    <p className="truncate max-w-[160px] min-w-0">{customerLabel(order)}</p>
                    {customerPhone(order) ? (
                      <p className="text-[11px] text-gray-400 font-mono dir-ltr text-right">{customerPhone(order)}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold',
                      order.type === 'RETAIL_WEBSITE' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800',
                    )}>
                      {order.type === 'RETAIL_WEBSITE' ? 'تکی' : 'عمده'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    <span className="block font-medium text-gray-800">{settlement.headline || '—'}</span>
                    {settlement.statusLabel ? (
                      <span className="block text-[10px] text-gray-400">{settlement.statusLabel}</span>
                    ) : null}
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
                      <AdminPackingSlipButton orderId={order.id} status={order.status} compact />
                      {actions.map((action) => {
                        const Icon = ACTION_ICON[action.to] ?? CheckCircle;
                        return (
                          <button
                            key={action.to}
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() => updateStatus(order.id, action.to, action.confirm)}
                            className={cn(
                              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                              action.kind === 'danger' ? 'text-error hover:opacity-80' : 'text-success hover:opacity-80',
                            )}
                            title={action.label}
                            aria-label={action.label}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        );
                      })}
                      {order.status === 'PROCESSING' ? (
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-primary hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          title="ثبت ارسال و کد رهگیری"
                          aria-label="ثبت ارسال و کد رهگیری"
                        >
                          <Truck className="h-4 w-4" />
                        </Link>
                      ) : null}
                      {!deleted && (
                        <>
                          <Link
                            href={`/admin/orders/${order.id}?edit=1`}
                            className="text-gray-400 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            title="ویرایش"
                            aria-label="ویرایش سفارش"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() => voidOrder(order.id, order.orderNumber)}
                            className="text-gray-400 hover:text-error focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            title="حذف (با بازگشت موجودی)"
                            aria-label={`حذف سفارش ${order.orderNumber}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-gray-400 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        title="جزئیات"
                        aria-label={`جزئیات سفارش ${order.orderNumber}`}
                      >
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
          <Pagination page={page} totalPages={meta.totalPages} onPageChange={(p) => replaceQuery({ page: p })} />
        </div>
      </div>
    </div>
  );
}

export function AdminOrders() {
  return (
    <Suspense fallback={<div className="space-y-5"><div className="skeleton h-10 w-40 rounded-lg" /><div className="skeleton h-64 rounded-2xl" /></div>}>
      <AdminOrdersInner />
    </Suspense>
  );
}

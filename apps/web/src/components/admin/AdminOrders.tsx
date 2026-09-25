'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Eye, CheckCircle, XCircle, Trash2, Pencil, Package, Truck, Eraser } from 'lucide-react';
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

type BulkResult = { action: string; results: Array<{ id: string; ok: boolean; error?: string }> };

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

function summarizeBulk(result: BulkResult, okLabel: string): string {
  const ok = result.results.filter((r) => r.ok).length;
  const fail = result.results.length - ok;
  if (fail <= 0) return `${okLabel}: ${ok.toLocaleString('fa-IR')} سفارش`;
  const firstError = result.results.find((r) => !r.ok)?.error;
  return `${okLabel}: ${ok.toLocaleString('fa-IR')} موفق، ${fail.toLocaleString('fa-IR')} ناموفق${firstError ? ` — ${firstError}` : ''}`;
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
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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

  useEffect(() => {
    setSelectedIds([]);
  }, [page, status, channelFilter]);

  const refresh = () => {
    refetch();
    refetchCounts();
  };

  const pageIds = useMemo(() => orders.map((order) => order.id), [orders]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedIds.includes(order.id)),
    [orders, selectedIds],
  );
  const selectedActive = selectedOrders.filter((order) => order.status !== 'DELETED');
  const selectedDeleted = selectedOrders.filter((order) => order.status === 'DELETED');

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const togglePage = () => {
    setSelectedIds((prev) => {
      if (allPageSelected) return prev.filter((id) => !pageIds.includes(id));
      return [...new Set([...prev, ...pageIds])];
    });
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

  const purgeOrder = async (id: string, orderNumber: string) => {
    if (!confirm(`سفارش ${orderNumber} به‌طور کامل حذف شود؟\nاین کار برگشت‌پذیر نیست و ردیف از لیست پاک می‌شود.`)) {
      return;
    }
    setBusyId(id);
    try {
      await apiClient.delete(`/orders/${id}/permanent`);
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در حذف کامل سفارش');
    } finally {
      setBusyId(null);
    }
  };

  const runBulkVoid = async () => {
    const ids = selectedActive.map((order) => order.id);
    if (!ids.length) {
      alert('برای حذف نرم، سفارش فعال انتخاب کنید.');
      return;
    }
    if (!confirm(`${ids.length.toLocaleString('fa-IR')} سفارش حذف نرم شود؟ ردیف‌ها برای آرشیو می‌مانند.`)) {
      return;
    }
    setBulkBusy(true);
    try {
      const result = await apiClient.post<BulkResult>('/orders/bulk/void', {
        ids,
        reason: 'حذف دسته‌ای از پنل ادمین',
      });
      alert(summarizeBulk(result, 'حذف نرم'));
      setSelectedIds([]);
      refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در حذف دسته‌ای');
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkPurge = async () => {
    const ids = selectedDeleted.map((order) => order.id);
    if (!ids.length) {
      alert('برای حذف کامل، فقط سفارش‌های حذف‌شده را انتخاب کنید.');
      return;
    }
    if (!confirm(`${ids.length.toLocaleString('fa-IR')} سفارش به‌طور کامل پاک شود؟ این کار برگشت‌پذیر نیست.`)) {
      return;
    }
    setBulkBusy(true);
    try {
      const result = await apiClient.post<BulkResult>('/orders/bulk/purge', { ids });
      alert(summarizeBulk(result, 'حذف کامل'));
      setSelectedIds([]);
      refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در حذف کامل دسته‌ای');
    } finally {
      setBulkBusy(false);
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

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
          <span className="text-xs font-medium text-gray-700">
            {selectedIds.length.toLocaleString('fa-IR')} انتخاب‌شده
            {selectedActive.length ? ` · ${selectedActive.length.toLocaleString('fa-IR')} فعال` : ''}
            {selectedDeleted.length ? ` · ${selectedDeleted.length.toLocaleString('fa-IR')} حذف‌شده` : ''}
          </span>
          <button
            type="button"
            disabled={bulkBusy || selectedActive.length === 0}
            onClick={runBulkVoid}
            className="btn btn-sm border border-error text-error hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            حذف نرم دسته‌ای
          </button>
          <button
            type="button"
            disabled={bulkBusy || selectedDeleted.length === 0}
            onClick={runBulkPurge}
            className="btn btn-sm bg-error text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Eraser className="h-3.5 w-3.5" />
            حذف کامل دسته‌ای
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => setSelectedIds([])}
            className="btn btn-outline btn-sm"
          >
            پاک‌کردن انتخاب
          </button>
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1140px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={togglePage}
                    disabled={loading || orders.length === 0}
                    aria-label="انتخاب همه سفارش‌های این صفحه"
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </th>
                {['شماره سفارش', 'مشتری', 'کانال', 'پرداخت', 'تاریخ', 'تعداد', 'مبلغ', 'وضعیت', 'عملیات'].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-24" /></td>
                  ))}</tr>
                ))
              ) : orders.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">{emptyQueueCopy(status)}</td></tr>
              ) : orders.map((order) => {
                const deleted = order.status === 'DELETED';
                const actions = adminQueueActions(order.status);
                const settlement = describeSettlement({
                  paymentMethod: order.paymentMethod,
                  payments,
                  orderId: order.id,
                });
                const checked = selectedIds.includes(order.id);
                return (
                <tr key={order.id} className={cn('hover:bg-gray-50 transition-colors', deleted && 'bg-red-50/40 opacity-80')}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(order.id)}
                      aria-label={`انتخاب سفارش ${order.orderNumber}`}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </td>
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
                            disabled={busyId === order.id || bulkBusy}
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
                            disabled={busyId === order.id || bulkBusy}
                            onClick={() => voidOrder(order.id, order.orderNumber)}
                            className="text-gray-400 hover:text-error focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            title="حذف (با بازگشت موجودی)"
                            aria-label={`حذف سفارش ${order.orderNumber}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {deleted && (
                        <button
                          type="button"
                          disabled={busyId === order.id || bulkBusy}
                          onClick={() => purgeOrder(order.id, order.orderNumber)}
                          className="text-error hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          title="حذف کامل از دیتابیس"
                          aria-label={`حذف کامل سفارش ${order.orderNumber}`}
                        >
                          <Eraser className="h-4 w-4" />
                        </button>
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

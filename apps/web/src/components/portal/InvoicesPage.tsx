'use client';

import { useState } from 'react';
import { Download, CheckCircle, Clock, AlertCircle, FileText, Trash2 } from 'lucide-react';
import { Badge, Pagination } from '@/components/ui';
import { useInvoices } from '@/lib/hooks/useInvoices';
import { apiClient } from '@/lib/api';

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  PAID: { label: 'پرداخت شده', cls: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3 w-3" /> },
  SENT: { label: 'ارسال شده', cls: 'bg-blue-100 text-blue-800', icon: <FileText className="h-3 w-3" /> },
  PARTIALLY_PAID: { label: 'نیمه پرداخت', cls: 'bg-amber-100 text-amber-800', icon: <Clock className="h-3 w-3" /> },
  OVERDUE: { label: 'معوق', cls: 'bg-red-100 text-red-800', icon: <AlertCircle className="h-3 w-3" /> },
  DRAFT: { label: 'پیش‌نویس', cls: 'bg-gray-100 text-gray-600', icon: <FileText className="h-3 w-3" /> },
};

function canCustomerDelete(status: string, paidAmount: number) {
  const paid = Number(paidAmount ?? 0);
  return paid === 0 && (status === 'DRAFT' || status === 'SENT');
}

export function InvoicesPage() {
  const [page, setPage] = useState(1);
  const { invoices, meta, loading, refetch } = useInvoices({ page });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalDebt = invoices.reduce((s, i) => s + (Number(i.total) - Number(i.paidAmount)), 0);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/invoices/${deleteId}`);
      setDeleteId(null);
      await refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در حذف');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">فاکتورها</h2>

      {!loading && invoices.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="card p-4">
            <p className="mb-1 text-xs text-gray-500">مانده بدهی</p>
            <p className="text-xl font-extrabold text-error">
              {(totalDebt / 10).toLocaleString('fa-IR')} تومان
            </p>
          </div>
          <div className="card p-4">
            <p className="mb-1 text-xs text-gray-500">تعداد فاکتور</p>
            <p className="text-xl font-extrabold text-primary">{meta.total}</p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['شماره فاکتور', 'نوع', 'تاریخ', 'مبلغ', 'پرداخت شده', 'وضعیت', ''].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 w-20 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    فاکتوری یافت نشد
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.DRAFT;
                  return (
                    <tr key={inv.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={inv.type === 'PROFORMA' ? 'neutral' : 'primary'}>
                          {inv.type === 'PROFORMA' ? 'پیش‌فاکتور' : 'فاکتور نهایی'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(inv.createdAt).toLocaleDateString('fa-IR')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-gray-900">
                        {(Number(inv.total) / 10).toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {(Number(inv.paidAmount) / 10).toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}
                        >
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/v1/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </a>
                          {canCustomerDelete(inv.status, inv.paidAmount) ? (
                            <button
                              type="button"
                              onClick={() => setDeleteId(inv.id)}
                              className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              حذف
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 px-4">
          <Pagination page={page} totalPages={meta.totalPages} onPageChange={setPage} />
        </div>
      </div>

      {deleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <h3 className="mb-2 text-lg font-bold">حذف فاکتور؟</h3>
            <p className="mb-6 text-sm text-gray-500">این فاکتور از لیست شما حذف می‌شود.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteId(null)} className="btn btn-outline btn-md flex-1">
                انصراف
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="btn btn-md flex-1 bg-error text-white"
              >
                {deleting ? '…' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

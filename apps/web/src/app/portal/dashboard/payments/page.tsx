'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, ArrowRight, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Invoice {
  id: string;
  invoiceNumber: string;
  type: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paidAmount: number;
  dueDate?: string;
  createdAt: string;
}

function toman(n: number) { return Math.round(Number(n) / 10).toLocaleString('fa-IR'); }

const STATUS = {
  DRAFT:    { label: 'پیش‌نویس', color: 'bg-gray-100 text-gray-600', icon: Clock },
  SENT:     { label: 'ارسال شده', color: 'bg-blue-100 text-blue-700', icon: Clock },
  PARTIALLY_PAID: { label: 'پرداخت ناقص', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  PAID:     { label: 'پرداخت شده', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  OVERDUE:  { label: 'سررسید گذشته', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  // Start an online ZarinPal payment for the invoice remainder.
  const payOnline = async (inv: Invoice) => {
    const remaining = Number(inv.total) - Number(inv.paidAmount);
    if (remaining <= 0) return;
    setPayingId(inv.id);
    try {
      const res = await apiClient.post<{ redirectUrl: string }>('/payments/start', {
        amount: remaining,
        invoiceId: inv.id,
        description: `پرداخت فاکتور ${inv.invoiceNumber} — پوشاک ترنم`,
      });
      window.location.href = res.redirectUrl;
    } catch (e: any) {
      alert(e?.message ?? 'خطا در اتصال به درگاه پرداخت');
      setPayingId(null);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: Invoice[]; total: number }>('/invoices?limit=50&sort=createdAt:DESC');
      setInvoices(res.data);
    } catch { setInvoices([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const outstanding = invoices.filter((i) => !['PAID', 'DRAFT'].includes(i.status))
    .reduce((sum, i) => sum + Number(i.total) - Number(i.paidAmount), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/portal/dashboard" className="text-gray-400 hover:text-primary">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-lg font-bold text-gray-900">فاکتورها و پرداخت‌ها</h2>
            <p className="text-sm text-gray-500">سابقه فاکتورها و وضعیت پرداخت</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Outstanding */}
      {outstanding > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">مانده بدهی</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{toman(outstanding)} تومان</p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['شماره فاکتور', 'تاریخ', 'سررسید', 'مبلغ کل', 'پرداخت شده', 'وضعیت', ''].map((h, i) => (
                <th key={i} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-20" /></td>
                ))}</tr>
              )) : invoices.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  فاکتوری ثبت نشده است
                </td></tr>
              ) : invoices.map((inv) => {
                const s = STATUS[inv.status as keyof typeof STATUS] ?? STATUS.DRAFT;
                const remaining = Number(inv.total) - Number(inv.paidAmount);
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm font-bold text-gray-900">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(inv.createdAt).toLocaleDateString('fa-IR')}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('fa-IR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">{toman(inv.total)} ت</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{toman(inv.paidAmount)} ت</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium w-fit', s.color)}>
                          <s.icon className="h-3 w-3" />{s.label}
                        </span>
                        {remaining > 0 && inv.status !== 'PAID' && (
                          <span className="text-[10px] text-gray-400">مانده: {toman(remaining)} ت</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {remaining > 0 && !['PAID', 'DRAFT'].includes(inv.status) && (
                        <button
                          onClick={() => payOnline(inv)}
                          disabled={payingId === inv.id}
                          className="btn btn-primary btn-sm flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          {payingId === inv.id ? 'اتصال...' : 'پرداخت آنلاین'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

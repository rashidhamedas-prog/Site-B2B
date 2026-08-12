'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock, ArrowRight, RefreshCw, CheckCircle, Clock, AlertCircle, XCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Schedule {
  id: string;
  installmentNo: number;
  dueAt: string;
  amountIrr: number;
  paidAmountIrr: number;
  status: string;
}

interface Contract {
  id: string;
  orderId: string;
  principalIrr: number;
  downPaymentIrr: number;
  termCount: number;
  effectiveAmountIrr: number;
  creditConsumedIrr: number;
  status: string;
  createdAt: string;
  schedules: Schedule[];
}

function toman(n: number) {
  return Math.round(Number(n) / 10).toLocaleString('fa-IR');
}

function faDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fa-IR');
  } catch {
    return '—';
  }
}

const CONTRACT_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'پیش‌نویس', color: 'bg-gray-100 text-gray-600' },
  ACTIVE: { label: 'فعال', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'تسویه‌شده', color: 'bg-green-100 text-green-700' },
  DEFAULTED: { label: 'نکول', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'لغو شده', color: 'bg-gray-100 text-gray-500' },
};

const SCHEDULE_STATUS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: 'در انتظار', color: 'bg-gray-100 text-gray-600', icon: Clock },
  PARTIAL: { label: 'پرداخت ناقص', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  PAID: { label: 'پرداخت شده', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  OVERDUE: { label: 'سررسید گذشته', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  CANCELLED: { label: 'لغو شده', color: 'bg-gray-100 text-gray-500', icon: XCircle },
};

export default function InstallmentsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<Contract[]>('/installments/mine');
      setContracts(Array.isArray(res) ? res : []);
    } catch {
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const outstanding = contracts
    .filter((c) => c.status === 'ACTIVE')
    .reduce((sum, c) => {
      const rem = (c.schedules ?? []).reduce((s, sch) => {
        if (['PAID', 'CANCELLED'].includes(sch.status)) return s;
        return s + Math.max(0, Number(sch.amountIrr) - Number(sch.paidAmountIrr));
      }, 0);
      return sum + rem;
    }, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/portal/dashboard" className="text-gray-400 hover:text-primary">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-lg font-bold text-gray-900">اقساط من</h2>
            <p className="text-sm text-gray-500">قراردادها و برنامه اقساط داخلی</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {outstanding > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <CalendarClock className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">مانده اقساط فعال</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{toman(outstanding)} تومان</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="skeleton h-5 w-40 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-3/4 rounded" />
            </div>
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          قرارداد اقساطی ثبت نشده است
        </div>
      ) : (
        <div className="space-y-4">
          {contracts.map((c) => {
            const cs = CONTRACT_STATUS[c.status] ?? CONTRACT_STATUS.DRAFT;
            return (
              <div key={c.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      قرارداد {c.termCount} قسطه
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      ایجاد: {faDate(c.createdAt)} · اصل: {toman(c.principalIrr)} تومان · پیش‌پرداخت:{' '}
                      {toman(c.downPaymentIrr)} تومان
                    </p>
                  </div>
                  <span className={cn('text-xs font-medium px-2.5 py-1 rounded-lg', cs.color)}>
                    {cs.label}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="border-b border-gray-50">
                        {['قسط', 'سررسید', 'مبلغ', 'پرداخت‌شده', 'وضعیت'].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(c.schedules ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">
                            برنامه‌ای ثبت نشده
                          </td>
                        </tr>
                      ) : (
                        (c.schedules ?? []).map((s) => {
                          const ss = SCHEDULE_STATUS[s.status] ?? SCHEDULE_STATUS.PENDING;
                          const Icon = ss.icon;
                          return (
                            <tr key={s.id}>
                              <td className="px-4 py-2.5 text-sm text-gray-800">
                                {s.installmentNo}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-gray-600">
                                {faDate(s.dueAt)}
                              </td>
                              <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                                {toman(s.amountIrr)}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-gray-600">
                                {toman(s.paidAmountIrr)}
                              </td>
                              <td className="px-4 py-2.5">
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg',
                                    ss.color,
                                  )}
                                >
                                  <Icon className="h-3 w-3" />
                                  {ss.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

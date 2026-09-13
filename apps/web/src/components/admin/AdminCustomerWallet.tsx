'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

type Entry = {
  id: string;
  direction: string;
  amount: number;
  reasonCode: string;
  note?: string | null;
  balanceAfter: number;
  createdAt: string;
};

const REASON_FA: Record<string, string> = {
  OPENING: 'مانده اولیه',
  ADMIN_CREDIT: 'افزایش توسط ادمین',
  ADMIN_DEBIT: 'کاهش توسط ادمین',
  ORDER_APPLY: 'مصرف در سفارش',
  ORDER_REFUND: 'برگشت سفارش',
  RMA: 'اعتبار مرجوعی',
  INVOICE: 'فاکتور',
  ADJUSTMENT: 'تعدیل سیستم',
};

function toman(n: number) {
  return Math.round(Number(n) / 10).toLocaleString('fa-IR');
}

export function AdminCustomerWallet({ customerId }: { customerId: string }) {
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [amountToman, setAmountToman] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get<{ balance: number; entries: Entry[] }>(
        `/customers/${customerId}/wallet`,
      );
      setBalance(Number(res.balance) || 0);
      setEntries(res.entries || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'دفتر کیف پول بارگذاری نشد');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const amount = Number(amountToman);
    if (!Number.isFinite(amount) || amount < 1 || note.trim().length < 3) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post(`/customers/${customerId}/wallet`, {
        direction,
        amountToman: Math.round(amount),
        note: note.trim(),
        idempotencyKey: `ui:${customerId}:${direction}:${Date.now()}`,
      });
      setAmountToman('');
      setNote('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'ثبت نشد');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-xs text-gray-500">مانده قابل استفاده</p>
        <p className="mt-1 text-2xl font-extrabold text-gray-900">{toman(balance)} تومان</p>
        <p className="mt-1 text-xs text-gray-400">دفتر ضمیمه‌ای است؛ موجودی از همان تراکنش‌ها به‌روز می‌شود.</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
        <h3 className="text-sm font-bold">ثبت دستی</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-gray-600">
            نوع
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'CREDIT' | 'DEBIT')}
              className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
            >
              <option value="CREDIT">افزایش اعتبار</option>
              <option value="DEBIT">کاهش اعتبار</option>
            </select>
          </label>
          <label className="text-xs text-gray-600">
            مبلغ (تومان)
            <input
              type="number"
              min={1}
              value={amountToman}
              onChange={(e) => setAmountToman(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
            />
          </label>
        </div>
        <label className="block text-xs text-gray-600">
          دلیل (الزامی)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="مثال: جبران تأخیر ارسال سفارش ۱۲۳"
          />
        </label>
        <button
          type="button"
          disabled={saving || Number(amountToman) < 1 || note.trim().length < 3}
          onClick={() => void submit()}
          className="btn btn-primary btn-sm min-h-11"
        >
          {saving ? 'در حال ثبت…' : 'ثبت در دفتر'}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-gray-100">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500">
              <th className="px-3 py-2 text-right">تاریخ</th>
              <th className="px-3 py-2 text-right">نوع</th>
              <th className="px-3 py-2 text-right">مبلغ</th>
              <th className="px-3 py-2 text-right">دلیل</th>
              <th className="px-3 py-2 text-right">مانده بعد</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">در حال بارگذاری دفتر…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">هنوز ردیفی نیست</td></tr>
            ) : entries.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {new Date(row.createdAt).toLocaleString('fa-IR')}
                </td>
                <td className="px-3 py-2">{row.direction === 'CREDIT' ? 'افزایش' : 'کاهش'}</td>
                <td className={`px-3 py-2 font-bold ${row.direction === 'DEBIT' ? 'text-red-600' : 'text-emerald-700'}`}>
                  {toman(row.amount)} ت
                </td>
                <td className="px-3 py-2">
                  <p>{REASON_FA[row.reasonCode] || row.reasonCode}</p>
                  {row.note ? <p className="text-xs text-gray-400">{row.note}</p> : null}
                </td>
                <td className="px-3 py-2">{toman(row.balanceAfter)} ت</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ShopperWalletBook() {
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<{ balance: number; entries: Entry[] }>('/account/wallet');
        setBalance(Number(res.balance) || 0);
        setEntries(res.entries || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'کیف پول در دسترس نیست');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[var(--retail-primary,#1B5C4A)] px-5 py-5 text-white">
        <p className="text-xs font-bold opacity-80">اعتبار کیف‌پول</p>
        <p className="mt-1 text-2xl font-extrabold">{toman(balance)} تومان</p>
        <p className="mt-1 text-xs opacity-70">در تسویه فروش تکی می‌توانید از اعتبار استفاده کنید.</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-gray-500">در حال بارگذاری گردش…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500">هنوز گردشی ثبت نشده است.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((row) => (
            <li key={row.id} className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex justify-between gap-3">
                <p className="text-sm font-bold">{REASON_FA[row.reasonCode] || row.reasonCode}</p>
                <p className={`text-sm font-extrabold ${row.direction === 'DEBIT' ? 'text-red-600' : 'text-emerald-700'}`}>
                  {row.direction === 'DEBIT' ? '−' : '+'}{toman(row.amount)} ت
                </p>
              </div>
              <p className="mt-1 text-xs text-gray-500">{new Date(row.createdAt).toLocaleString('fa-IR')}</p>
              {row.note ? <p className="mt-1 text-xs text-gray-600">{row.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

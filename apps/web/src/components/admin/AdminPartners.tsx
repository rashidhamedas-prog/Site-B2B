'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Handshake, KeyRound, Pause, Play, Plus, Copy, Wallet } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { normalizePhone } from '@/lib/phone';

type VendorStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED';

interface PublicVendor {
  id: string;
  name: string;
  phone: string;
  status: VendorStatus;
  acceptSlaHours: number;
  settlementHoldDays: number;
  notes: string | null;
  invitedAt: string | null;
}

interface LedgerSummary {
  heldIrr: number;
  availableIrr: number;
  paidIrr: number;
  data: Array<{
    id: string;
    entryType: string;
    amountIrr: number;
    availableAt: string;
    status: string;
    orderId: string | null;
    fulfillmentOrderId: string | null;
    createdAt: string;
  }>;
}

const STATUS_LABEL: Record<VendorStatus, string> = {
  INVITED: 'دعوت‌شده',
  ACTIVE: 'فعال',
  SUSPENDED: 'معلق',
};

const emptyForm = {
  name: '',
  phone: '',
  acceptSlaHours: 12,
  settlementHoldDays: 7,
  notes: '',
};

const fieldClass =
  'w-full min-h-11 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

function toman(n: number) {
  return Math.round(Number(n) / 10).toLocaleString('fa-IR');
}

export function AdminPartners() {
  const [rows, setRows] = useState<PublicVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [oneTimePassword, setOneTimePassword] = useState<{ name: string; password: string } | null>(null);
  const [ledgerVendorId, setLedgerVendorId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerSummary | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const res = await apiClient.get<{ data: PublicVendor[] }>('/vendors');
      setRows(res.data ?? []);
    } catch (e: unknown) {
      setRows([]);
      setListError(e instanceof Error ? e.message : 'بارگذاری همکاران ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleInvite = async () => {
    if (!form.name.trim() || !form.phone) {
      setError('نام و شماره الزامی است');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.post<{ vendor: PublicVendor; initialPassword: string }>('/vendors', {
        name: form.name.trim(),
        phone: normalizePhone(form.phone),
        acceptSlaHours: Number(form.acceptSlaHours),
        settlementHoldDays: Number(form.settlementHoldDays),
        notes: form.notes.trim() || undefined,
      });
      setShowCreate(false);
      setForm(emptyForm);
      setOneTimePassword({ name: res.vendor.name, password: res.initialPassword });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'دعوت همکار ناموفق بود');
    } finally {
      setSaving(false);
    }
  };

  const patchStatus = async (row: PublicVendor, status: VendorStatus) => {
    setListError('');
    try {
      await apiClient.patch(`/vendors/${row.id}`, { status });
      await load();
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : 'تغییر وضعیت ناموفق بود');
    }
  };

  const rotatePassword = async (row: PublicVendor) => {
    if (!window.confirm(`رمز ورود «${row.name}» عوض شود؟ نشست فعلی همکار باطل می‌شود.`)) return;
    setListError('');
    try {
      const res = await apiClient.post<{ vendor: PublicVendor; initialPassword: string }>(
        `/vendors/${row.id}/rotate-password`,
        {},
      );
      setOneTimePassword({ name: res.vendor.name, password: res.initialPassword });
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : 'تغییر رمز ناموفق بود');
    }
  };

  const copyPassword = async () => {
    if (!oneTimePassword) return;
    try {
      await navigator.clipboard.writeText(oneTimePassword.password);
    } catch {
      /* ignore */
    }
  };

  const openLedger = async (row: PublicVendor) => {
    setLedgerVendorId(row.id);
    setLedger(null);
    setLedgerLoading(true);
    setListError('');
    try {
      const res = await apiClient.get<LedgerSummary>(`/vendors/${row.id}/ledger`);
      setLedger(res);
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : 'بارگذاری دفتر ناموفق بود');
      setLedgerVendorId(null);
    } finally {
      setLedgerLoading(false);
    }
  };

  const markPaid = async () => {
    if (!ledgerVendorId || !ledger || ledger.availableIrr <= 0) return;
    const name = rows.find((r) => r.id === ledgerVendorId)?.name ?? 'همکار';
    if (
      !window.confirm(
        `پرداخت ${toman(ledger.availableIrr)} تومان قابل‌برداشت برای «${name}» ثبت شود؟`,
      )
    ) {
      return;
    }
    setPaying(true);
    setListError('');
    try {
      const res = await apiClient.post<{ paidCount: number; paidIrr: number; summary: LedgerSummary }>(
        `/vendors/${ledgerVendorId}/ledger/pay`,
        {},
      );
      setLedger(res.summary);
      if (res.paidCount === 0) {
        setListError('ردیفی برای پرداخت نبود (شاید قبلاً ثبت شده).');
      }
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : 'ثبت پرداخت ناموفق بود');
    } finally {
      setPaying(false);
    }
  };

  const ledgerVendor = rows.find((r) => r.id === ledgerVendorId) ?? null;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">همکاران فروش</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            همکار فقط کالاهای خودش را می‌بیند و ارسال می‌کند. فاکتور و فروشنده در سایت همچنان ترنم است.
            هزینه پست واقعی با همکار است؛ کرایه‌ای که مشتری در سایت می‌پردازد برای ترنم می‌ماند.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            setError('');
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          دعوت همکار
        </button>
      </div>

      {listError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{listError}</p>
      )}

      {oneTimePassword && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">رمز موقت «{oneTimePassword.name}» — فقط همین یک‌بار نمایش داده می‌شود.</p>
          <p className="mt-1">این رمز را از پیامک یا تماس به همکار بدهید. در سیستم ذخیره نمی‌شود.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code dir="ltr" className="rounded-lg bg-white px-3 py-2 font-mono text-base">
              {oneTimePassword.password}
            </code>
            <button
              type="button"
              onClick={() => void copyPassword()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-sm"
            >
              <Copy className="h-4 w-4" />
              کپی
            </button>
            <button type="button" onClick={() => setOneTimePassword(null)} className="min-h-11 px-3 text-sm">
              بستن
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
            <Handshake className="h-4 w-4" />
            دعوت همکار جدید
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              نام همکار
              <input
                className={cn(fieldClass, 'mt-1')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className="text-sm">
              موبایل
              <input
                className={cn(fieldClass, 'mt-1')}
                dir="ltr"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0915…"
                required
              />
            </label>
            <label className="text-sm">
              مهلت قبول سفارش (ساعت)
              <input
                className={cn(fieldClass, 'mt-1')}
                type="number"
                min={1}
                max={168}
                value={form.acceptSlaHours}
                onChange={(e) => setForm({ ...form, acceptSlaHours: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm">
              hold تسویه (روز)
              <input
                className={cn(fieldClass, 'mt-1')}
                type="number"
                min={0}
                max={90}
                value={form.settlementHoldDays}
                onChange={(e) => setForm({ ...form, settlementHoldDays: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              یادداشت داخلی
              <textarea
                className={cn(fieldClass, 'mt-1')}
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleInvite()}
              className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'در حال ذخیره…' : 'دعوت و ساخت رمز'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">همکار</th>
              <th className="px-4 py-3 font-medium">موبایل</th>
              <th className="px-4 py-3 font-medium">وضعیت</th>
              <th className="px-4 py-3 font-medium">SLA</th>
              <th className="px-4 py-3 font-medium">hold</th>
              <th className="px-4 py-3 font-medium">اقدام</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  در حال بارگذاری…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  هنوز همکاری دعوت نشده. از دکمه بالا شروع کنید — ثبت‌نام عمومی وجود ندارد.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3" dir="ltr">
                    {row.phone}
                  </td>
                  <td className="px-4 py-3">{STATUS_LABEL[row.status]}</td>
                  <td className="px-4 py-3">{row.acceptSlaHours} ساعت</td>
                  <td className="px-4 py-3">{row.settlementHoldDays} روز</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {row.status === 'SUSPENDED' ? (
                        <button
                          type="button"
                          onClick={() => void patchStatus(row, 'ACTIVE')}
                          className="inline-flex min-h-11 items-center gap-1 rounded-lg border px-3"
                        >
                          <Play className="h-4 w-4" />
                          فعال
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void patchStatus(row, 'SUSPENDED')}
                          className="inline-flex min-h-11 items-center gap-1 rounded-lg border px-3"
                        >
                          <Pause className="h-4 w-4" />
                          تعلیق
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void rotatePassword(row)}
                        className="inline-flex min-h-11 items-center gap-1 rounded-lg border px-3"
                      >
                        <KeyRound className="h-4 w-4" />
                        رمز جدید
                      </button>
                      <button
                        type="button"
                        onClick={() => void openLedger(row)}
                        className="inline-flex min-h-11 items-center gap-1 rounded-lg border px-3"
                      >
                        <BookOpen className="h-4 w-4" />
                        دفتر
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {ledgerVendorId && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <Wallet className="h-4 w-4" />
              دفتر کمیسیون {ledgerVendor ? `«${ledgerVendor.name}»` : ''}
            </div>
            <button
              type="button"
              onClick={() => {
                setLedgerVendorId(null);
                setLedger(null);
              }}
              className="min-h-11 px-3 text-sm text-gray-600"
            >
              بستن
            </button>
          </div>
          {ledgerLoading || !ledger ? (
            <p className="text-sm text-gray-500">در حال بارگذاری…</p>
          ) : (
            <>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <dt className="text-xs text-gray-500">در انتظار hold</dt>
                  <dd className="mt-1 text-sm font-bold">{toman(ledger.heldIrr)} ت</dd>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2">
                  <dt className="text-xs text-emerald-800">قابل برداشت</dt>
                  <dd className="mt-1 text-sm font-bold text-emerald-900">{toman(ledger.availableIrr)} ت</dd>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <dt className="text-xs text-gray-500">پرداخت‌شده</dt>
                  <dd className="mt-1 text-sm font-bold">{toman(ledger.paidIrr)} ت</dd>
                </div>
              </dl>
              <div className="mt-4">
                <button
                  type="button"
                  disabled={paying || ledger.availableIrr <= 0}
                  onClick={() => void markPaid()}
                  className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {paying ? 'در حال ثبت…' : 'ثبت پرداخت قابل‌برداشت'}
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  فقط ردیف‌های قابل‌برداشت به «پرداخت‌شده» تبدیل می‌شوند. این عمل از نظر حسابداری باید با واریز واقعی همراه باشد.
                </p>
              </div>
              {ledger.data.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-right text-xs">
                    <thead className="text-gray-500">
                      <tr>
                        <th className="px-2 py-2 font-medium">مبلغ</th>
                        <th className="px-2 py-2 font-medium">وضعیت</th>
                        <th className="px-2 py-2 font-medium">آزادسازی</th>
                        <th className="px-2 py-2 font-medium">سفارش</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.data.slice(0, 20).map((entry) => (
                        <tr key={entry.id} className="border-t border-gray-100">
                          <td className="px-2 py-2">{toman(entry.amountIrr)} ت</td>
                          <td className="px-2 py-2">{entry.status}</td>
                          <td className="px-2 py-2" dir="ltr">
                            {new Date(entry.availableAt).toLocaleDateString('fa-IR')}
                          </td>
                          <td className="px-2 py-2 font-mono" dir="ltr">
                            {entry.orderId ? `${entry.orderId.slice(0, 8)}…` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

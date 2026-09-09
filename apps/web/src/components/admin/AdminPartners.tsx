'use client';

import { useCallback, useEffect, useState } from 'react';
import { Handshake, KeyRound, Pause, Play, Plus, Copy } from 'lucide-react';
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

export function AdminPartners() {
  const [rows, setRows] = useState<PublicVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [oneTimePassword, setOneTimePassword] = useState<{ name: string; password: string } | null>(null);

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
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

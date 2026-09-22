'use client';

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  BookOpen,
  Handshake,
  KeyRound,
  Pause,
  Pencil,
  Play,
  Plus,
  Copy,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { normalizePhone } from '@/lib/phone';

type VendorStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED';
type StatusFilter = 'ALL' | VendorStatus;

interface VendorUsage {
  productCount: number;
  fulfillmentCount: number;
  ledgerCount: number;
  orderItemCount: number;
}

interface PublicVendor {
  id: string;
  name: string;
  phone: string;
  status: VendorStatus;
  acceptSlaHours: number;
  settlementHoldDays: number;
  notes: string | null;
  invitedAt: string | null;
  usage?: VendorUsage;
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

interface PartnerForm {
  name: string;
  phone: string;
  acceptSlaHours: number;
  settlementHoldDays: number;
  notes: string;
  status: VendorStatus;
}

const STATUS_LABEL: Record<VendorStatus, string> = {
  INVITED: 'دعوت‌شده',
  ACTIVE: 'فعال',
  SUSPENDED: 'معلق',
};

const LEDGER_STATUS: Record<string, string> = {
  HELD: 'در انتظار',
  AVAILABLE: 'قابل برداشت',
  PAID: 'پرداخت‌شده',
};

const EMPTY_USAGE: VendorUsage = {
  productCount: 0,
  fulfillmentCount: 0,
  ledgerCount: 0,
  orderItemCount: 0,
};

const emptyForm: PartnerForm = {
  name: '',
  phone: '',
  acceptSlaHours: 12,
  settlementHoldDays: 7,
  notes: '',
  status: 'INVITED',
};

const fieldClass =
  'w-full min-h-11 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

function toman(n: number) {
  return Math.round(Number(n) / 10).toLocaleString('fa-IR');
}

function faCount(n: number) {
  return n.toLocaleString('fa-IR');
}

function usageOf(row: PublicVendor): VendorUsage {
  return row.usage ?? EMPTY_USAGE;
}

function historyParts(usage: VendorUsage): string[] {
  const parts: string[] = [];
  if (usage.productCount > 0) parts.push(`${faCount(usage.productCount)} کالا`);
  if (usage.fulfillmentCount > 0) parts.push(`${faCount(usage.fulfillmentCount)} مرسوله`);
  if (usage.orderItemCount > 0) parts.push(`${faCount(usage.orderItemCount)} قلم سفارش`);
  if (usage.ledgerCount > 0) parts.push(`${faCount(usage.ledgerCount)} ردیف دفتر`);
  return parts;
}

function messageOf(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function StatusBadge({ status }: { status: VendorStatus }) {
  const tone =
    status === 'ACTIVE'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      : status === 'SUSPENDED'
        ? 'bg-gray-100 text-gray-600 ring-gray-200'
        : 'bg-amber-50 text-amber-900 ring-amber-200';
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1', tone)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function AdminPartners() {
  const formId = useId();
  const [rows, setRows] = useState<PublicVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [editor, setEditor] = useState<'create' | PublicVendor | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const [oneTimePassword, setOneTimePassword] = useState<{ name: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PublicVendor | null>(null);
  const [deleteTyped, setDeleteTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<PublicVendor | null>(null);
  const [ledgerVendorId, setLedgerVendorId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerSummary | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payArmed, setPayArmed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const res = await apiClient.get<{ data: PublicVendor[] }>('/vendors');
      setRows(res.data ?? []);
    } catch (e: unknown) {
      setRows([]);
      setListError(messageOf(e, 'بارگذاری همکاران ناموفق بود'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const next = { ALL: rows.length, INVITED: 0, ACTIVE: 0, SUSPENDED: 0 };
    for (const row of rows) next[row.status] += 1;
    return next;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().replace(/\s+/g, '');
    const qDigits = q.replace(/\D/g, '');
    return rows.filter((row) => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (!q) return true;
      const phone = row.phone.replace(/\D/g, '');
      return row.name.includes(query.trim()) || (qDigits.length > 0 && phone.includes(qDigits));
    });
  }, [rows, query, statusFilter]);

  const closeEditor = () => {
    setEditor(null);
    setError('');
  };

  const openCreate = () => {
    setForm(emptyForm);
    setError('');
    setEditor('create');
  };

  const openEdit = (row: PublicVendor) => {
    setForm({
      name: row.name,
      phone: row.phone,
      acceptSlaHours: row.acceptSlaHours,
      settlementHoldDays: row.settlementHoldDays,
      notes: row.notes ?? '',
      status: row.status,
    });
    setError('');
    setEditor(row);
  };

  useEffect(() => {
    if (!editor && !deleteTarget && !rotateTarget && !ledgerVendorId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (deleteTarget) {
        setDeleteTarget(null);
        return;
      }
      if (rotateTarget) {
        setRotateTarget(null);
        return;
      }
      if (editor) {
        closeEditor();
        return;
      }
      setLedgerVendorId(null);
      setLedger(null);
      setPayArmed(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, deleteTarget, rotateTarget, ledgerVendorId]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone) {
      setError('نام و شماره الزامی است');
      return;
    }
    setSaving(true);
    setError('');
    const phone = normalizePhone(form.phone);
    const payload = {
      name: form.name.trim(),
      phone,
      acceptSlaHours: Number(form.acceptSlaHours),
      settlementHoldDays: Number(form.settlementHoldDays),
      notes: form.notes.trim(),
    };
    try {
      if (editor === 'create') {
        const res = await apiClient.post<{ vendor: PublicVendor; initialPassword: string }>('/vendors', payload);
        setOneTimePassword({ name: res.vendor.name, password: res.initialPassword });
        setCopied(false);
        setNotice('');
      } else if (editor) {
        await apiClient.patch(`/vendors/${editor.id}`, { ...payload, status: form.status });
        setNotice(`تغییرات «${form.name.trim()}» ذخیره شد.`);
      }
      closeEditor();
      setForm(emptyForm);
      await load();
    } catch (e: unknown) {
      setError(messageOf(e, editor === 'create' ? 'دعوت همکار ناموفق بود' : 'ذخیره تغییرات ناموفق بود'));
    } finally {
      setSaving(false);
    }
  };

  const patchStatus = async (row: PublicVendor, status: VendorStatus) => {
    setListError('');
    try {
      await apiClient.patch(`/vendors/${row.id}`, { status });
      setNotice(status === 'SUSPENDED' ? `«${row.name}» معلق شد.` : `«${row.name}» فعال شد.`);
      setDeleteTarget(null);
      await load();
    } catch (e: unknown) {
      setListError(messageOf(e, 'تغییر وضعیت ناموفق بود'));
    }
  };

  const rotatePassword = async () => {
    if (!rotateTarget) return;
    setListError('');
    try {
      const res = await apiClient.post<{ vendor: PublicVendor; initialPassword: string }>(
        `/vendors/${rotateTarget.id}/rotate-password`,
        {},
      );
      setOneTimePassword({ name: res.vendor.name, password: res.initialPassword });
      setCopied(false);
      setRotateTarget(null);
    } catch (e: unknown) {
      setListError(messageOf(e, 'تغییر رمز ناموفق بود'));
      setRotateTarget(null);
    }
  };

  const copyPassword = async () => {
    if (!oneTimePassword) return;
    try {
      await navigator.clipboard.writeText(oneTimePassword.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const openDelete = (row: PublicVendor) => {
    setDeleteTarget(row);
    setDeleteTyped('');
    setError('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (historyParts(usageOf(deleteTarget)).length > 0) return;
    if (deleteTyped.trim() !== deleteTarget.name.trim()) {
      setError('نام همکار را دقیق بنویسید');
      return;
    }
    setDeleting(true);
    setError('');
    setListError('');
    try {
      await apiClient.delete(`/vendors/${deleteTarget.id}`);
      setNotice(`«${deleteTarget.name}» حذف شد. شماره برای دعوت دوباره آزاد است.`);
      setDeleteTarget(null);
      if (ledgerVendorId === deleteTarget.id) {
        setLedgerVendorId(null);
        setLedger(null);
      }
      await load();
    } catch (e: unknown) {
      setError(messageOf(e, 'حذف همکار ناموفق بود'));
    } finally {
      setDeleting(false);
    }
  };

  const openLedger = async (row: PublicVendor) => {
    setLedgerVendorId(row.id);
    setLedger(null);
    setPayArmed(false);
    setLedgerLoading(true);
    setListError('');
    try {
      const res = await apiClient.get<LedgerSummary>(`/vendors/${row.id}/ledger`);
      setLedger(res);
    } catch (e: unknown) {
      setListError(messageOf(e, 'بارگذاری دفتر ناموفق بود'));
      setLedgerVendorId(null);
    } finally {
      setLedgerLoading(false);
    }
  };

  const markPaid = async () => {
    if (!ledgerVendorId || !ledger || ledger.availableIrr <= 0) return;
    setPaying(true);
    setListError('');
    try {
      const res = await apiClient.post<{ paidCount: number; paidIrr: number; summary: LedgerSummary }>(
        `/vendors/${ledgerVendorId}/ledger/pay`,
        {},
      );
      setLedger(res.summary);
      setPayArmed(false);
      if (res.paidCount === 0) {
        setListError('ردیفی برای پرداخت نبود (شاید قبلاً ثبت شده).');
      } else {
        setNotice(`پرداخت ${toman(res.paidIrr)} تومان ثبت شد.`);
      }
    } catch (e: unknown) {
      setListError(messageOf(e, 'ثبت پرداخت ناموفق بود'));
    } finally {
      setPaying(false);
    }
  };

  const ledgerVendor = rows.find((r) => r.id === ledgerVendorId) ?? null;
  const editing = editor && editor !== 'create' ? editor : null;
  const filters: Array<{ id: StatusFilter; label: string }> = [
    { id: 'ALL', label: 'همه' },
    { id: 'ACTIVE', label: 'فعال' },
    { id: 'INVITED', label: 'دعوت‌شده' },
    { id: 'SUSPENDED', label: 'معلق' },
  ];

  return (
    <div className="space-y-5" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-primary">دراپ‌شیپ</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">همکاران فروش</h1>
          <p className="mt-2 text-sm leading-7 text-gray-600">
            همکار فقط کالا و ارسال خودش را می‌بیند. فاکتور و نام فروشنده روی سایت همچنان ترنم است.
            هزینه پست واقعی با همکار است و کرایه‌ای که مشتری می‌پردازد برای ترنم می‌ماند.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-light"
        >
          <Plus className="h-4 w-4" />
          دعوت همکار
        </button>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="خلاصه همکاران">
        {(
          [
            ['ALL', 'همه همکاران', counts.ALL],
            ['ACTIVE', 'فعال', counts.ACTIVE],
            ['INVITED', 'دعوت‌شده', counts.INVITED],
            ['SUSPENDED', 'معلق', counts.SUSPENDED],
          ] as const
        ).map(([id, label, value]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatusFilter(id)}
            className={cn(
              'rounded-2xl border px-4 py-3 text-right transition-colors',
              statusFilter === id ? 'border-primary/40 bg-primary/5' : 'border-gray-200 bg-white hover:bg-gray-50',
            )}
          >
            <span className="block text-xs text-gray-500">{label}</span>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-gray-900">{faCount(value)}</span>
          </button>
        ))}
      </section>

      {notice && (
        <p className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-emerald-800" aria-label="بستن پیام">
            <X className="h-4 w-4" />
          </button>
        </p>
      )}

      {listError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {listError}
        </p>
      )}

      {oneTimePassword && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">رمز موقت «{oneTimePassword.name}» فقط همین یک‌بار نشان داده می‌شود.</p>
          <p className="mt-1 leading-6">آن را از پیامک یا تماس به همکار بدهید. در سیستم ذخیره نمی‌شود.</p>
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
              {copied ? 'کپی شد' : 'کپی'}
            </button>
            <button type="button" onClick={() => setOneTimePassword(null)} className="min-h-11 px-3 text-sm">
              بستن
            </button>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">جستجوی همکار</span>
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="نام یا موبایل"
              className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-3 pr-10 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="فیلتر وضعیت">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={statusFilter === item.id}
                onClick={() => setStatusFilter(item.id)}
                className={cn(
                  'min-h-9 rounded-full px-3 text-xs font-semibold',
                  statusFilter === item.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {item.label}
                <span className="mr-1 tabular-nums opacity-70">{faCount(counts[item.id])}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Handshake className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 font-semibold text-gray-900">هنوز همکاری دعوت نشده</p>
            <p className="mt-1 text-sm text-gray-500">ثبت‌نام عمومی وجود ندارد. از دعوت همکار شروع کنید.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold text-gray-900">همکاری با این فیلتر پیدا نشد</p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setStatusFilter('ALL');
              }}
              className="mt-3 text-sm font-semibold text-primary"
            >
              پاک کردن فیلتر
            </button>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 md:hidden">
              {visible.map((row) => (
                <li key={row.id} className="space-y-3 p-4">
                  <PartnerIdentity row={row} />
                  <PartnerActions
                    row={row}
                    onEdit={() => openEdit(row)}
                    onLedger={() => void openLedger(row)}
                    onStatus={(status) => void patchStatus(row, status)}
                    onRotate={() => setRotateTarget(row)}
                    onDelete={() => openDelete(row)}
                  />
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[880px] text-right text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">همکار</th>
                    <th className="px-4 py-3 font-medium">وضعیت</th>
                    <th className="px-4 py-3 font-medium">قبول سفارش</th>
                    <th className="px-4 py-3 font-medium">نگهداری تسویه</th>
                    <th className="px-4 py-3 font-medium">سابقه</th>
                    <th className="px-4 py-3 font-medium">اقدام</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const history = historyParts(usageOf(row));
                    return (
                      <tr key={row.id} className="border-t border-gray-100 align-top">
                        <td className="px-4 py-4">
                          <PartnerIdentity row={row} />
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-4 tabular-nums text-gray-700">{faCount(row.acceptSlaHours)} ساعت</td>
                        <td className="px-4 py-4 tabular-nums text-gray-700">{faCount(row.settlementHoldDays)} روز</td>
                        <td className="px-4 py-4 text-xs leading-6 text-gray-500">
                          {history.length ? history.join(' · ') : 'بدون سابقه — قابل حذف'}
                        </td>
                        <td className="px-4 py-4">
                          <PartnerActions
                            row={row}
                            onEdit={() => openEdit(row)}
                            onLedger={() => void openLedger(row)}
                            onStatus={(status) => void patchStatus(row, status)}
                            onRotate={() => setRotateTarget(row)}
                            onDelete={() => openDelete(row)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {editor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/40 p-0 sm:items-center sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${formId}-title`}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id={`${formId}-title`} className="text-lg font-bold text-gray-900">
                  {editing ? `ویرایش «${editing.name}»` : 'دعوت همکار جدید'}
                </h2>
                <p className="mt-1 text-xs leading-6 text-gray-500">
                  {editing
                    ? 'شماره، همان ورود پنل همکار است. تغییر آن نشست فعلی را باطل نمی‌کند؛ برای قطع ورود، رمز را عوض کنید یا همکار را معلق کنید.'
                    : 'رمز موقت بعد از ذخیره فقط یک‌بار نشان داده می‌شود.'}
                </p>
              </div>
              <button type="button" onClick={closeEditor} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="بستن">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700" htmlFor={`${formId}-name`}>
                نام همکار
                <input
                  id={`${formId}-name`}
                  className={cn(fieldClass, 'mt-1 font-normal')}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoComplete="organization"
                  required
                />
              </label>
              <label className="text-sm font-medium text-gray-700" htmlFor={`${formId}-phone`}>
                موبایل ورود
                <input
                  id={`${formId}-phone`}
                  className={cn(fieldClass, 'mt-1 font-normal')}
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0915…"
                  required
                />
              </label>
              <label className="text-sm font-medium text-gray-700" htmlFor={`${formId}-sla`}>
                مهلت قبول سفارش (ساعت)
                <input
                  id={`${formId}-sla`}
                  className={cn(fieldClass, 'mt-1 font-normal')}
                  type="number"
                  min={1}
                  max={168}
                  value={form.acceptSlaHours}
                  onChange={(e) => setForm({ ...form, acceptSlaHours: Number(e.target.value) })}
                />
              </label>
              <label className="text-sm font-medium text-gray-700" htmlFor={`${formId}-hold`}>
                نگهداری تسویه (روز)
                <input
                  id={`${formId}-hold`}
                  className={cn(fieldClass, 'mt-1 font-normal')}
                  type="number"
                  min={0}
                  max={90}
                  value={form.settlementHoldDays}
                  onChange={(e) => setForm({ ...form, settlementHoldDays: Number(e.target.value) })}
                />
              </label>
              {editing && (
                <label className="text-sm font-medium text-gray-700 sm:col-span-2" htmlFor={`${formId}-status`}>
                  وضعیت
                  <select
                    id={`${formId}-status`}
                    className={cn(fieldClass, 'mt-1 font-normal')}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as VendorStatus })}
                  >
                    <option value="INVITED">دعوت‌شده</option>
                    <option value="ACTIVE">فعال</option>
                    <option value="SUSPENDED">معلق</option>
                  </select>
                </label>
              )}
              <label className="text-sm font-medium text-gray-700 sm:col-span-2" htmlFor={`${formId}-notes`}>
                یادداشت داخلی
                <textarea
                  id={`${formId}-notes`}
                  className={cn(fieldClass, 'mt-1 font-normal')}
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'در حال ذخیره…' : editing ? 'ذخیره تغییرات' : 'دعوت و ساخت رمز'}
              </button>
              <button type="button" onClick={closeEditor} className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm">
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteDialog
          row={deleteTarget}
          typed={deleteTyped}
          error={error}
          deleting={deleting}
          onTyped={setDeleteTyped}
          onClose={() => {
            setDeleteTarget(null);
            setError('');
          }}
          onConfirm={() => void confirmDelete()}
          onSuspend={() => void patchStatus(deleteTarget, 'SUSPENDED')}
        />
      )}

      {rotateTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/40 p-4 sm:items-center">
          <div role="dialog" aria-modal="true" aria-labelledby="rotate-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="rotate-title" className="text-lg font-bold text-gray-900">
              رمز جدید برای «{rotateTarget.name}»
            </h2>
            <p className="mt-2 text-sm leading-7 text-gray-600">
              رمز قبلی از کار می‌افتد و نشست فعلی همکار باطل می‌شود. رمز تازه فقط یک‌بار نشان داده می‌شود.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void rotatePassword()}
                className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white"
              >
                ساخت رمز جدید
              </button>
              <button type="button" onClick={() => setRotateTarget(null)} className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm">
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {ledgerVendorId && (
        <div className="fixed inset-0 z-40">
          <button type="button" className="absolute inset-0 bg-gray-950/30" aria-label="بستن دفتر" onClick={() => { setLedgerVendorId(null); setLedger(null); setPayArmed(false); }} />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl" aria-label="دفتر کمیسیون">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Wallet className="h-4 w-4 text-primary" />
                  دفتر کمیسیون
                </p>
                <p className="mt-1 text-sm text-gray-600">{ledgerVendor?.name ?? 'همکار'}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLedgerVendorId(null);
                  setLedger(null);
                  setPayArmed(false);
                }}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="بستن"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {ledgerLoading || !ledger ? (
                <p className="text-sm text-gray-500">در حال بارگذاری…</p>
              ) : (
                <>
                  <dl className="grid gap-3">
                    <LedgerStat label="در انتظار نگهداری" value={`${toman(ledger.heldIrr)} تومان`} />
                    <LedgerStat label="قابل برداشت" value={`${toman(ledger.availableIrr)} تومان`} emphasis />
                    <LedgerStat label="پرداخت‌شده" value={`${toman(ledger.paidIrr)} تومان`} />
                  </dl>
                  <div className="mt-4">
                    {payArmed ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                        <p>
                          پرداخت {toman(ledger.availableIrr)} تومان برای «{ledgerVendor?.name ?? 'همکار'}» ثبت شود؟ این ثبت باید با واریز واقعی همراه باشد.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={paying}
                            onClick={() => void markPaid()}
                            className="min-h-10 rounded-lg bg-primary px-3 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {paying ? 'در حال ثبت…' : 'تأیید پرداخت'}
                          </button>
                          <button type="button" onClick={() => setPayArmed(false)} className="min-h-10 rounded-lg px-3 text-sm">
                            انصراف
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={ledger.availableIrr <= 0}
                        onClick={() => setPayArmed(true)}
                        className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        ثبت پرداخت قابل‌برداشت
                      </button>
                    )}
                  </div>
                  {ledger.data.length > 0 && (
                    <ul className="mt-5 divide-y divide-gray-100 text-sm">
                      {ledger.data.slice(0, 20).map((entry) => (
                        <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                          <div>
                            <p className="font-semibold tabular-nums text-gray-900">{toman(entry.amountIrr)} تومان</p>
                            <p className="mt-0.5 text-xs text-gray-500" dir="ltr">
                              {new Date(entry.availableAt).toLocaleDateString('fa-IR')}
                              {entry.orderId ? ` · ${entry.orderId.slice(0, 8)}` : ''}
                            </p>
                          </div>
                          <span className="text-xs text-gray-600">{LEDGER_STATUS[entry.status] ?? entry.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function PartnerIdentity({ row }: { row: PublicVendor }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-gray-900">{row.name}</p>
        <span className="md:hidden">
          <StatusBadge status={row.status} />
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500" dir="ltr">
        {row.phone}
      </p>
      {row.notes ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{row.notes}</p> : null}
      <p className="mt-2 text-xs text-gray-400 md:hidden">
        قبول سفارش {faCount(row.acceptSlaHours)} ساعت · نگهداری {faCount(row.settlementHoldDays)} روز
        {historyParts(usageOf(row)).length ? ` · ${historyParts(usageOf(row)).join(' · ')}` : ' · بدون سابقه'}
      </p>
    </div>
  );
}

function PartnerActions({
  row,
  onEdit,
  onLedger,
  onStatus,
  onRotate,
  onDelete,
}: {
  row: PublicVendor;
  onEdit: () => void;
  onLedger: () => void;
  onStatus: (status: VendorStatus) => void;
  onRotate: () => void;
  onDelete: () => void;
}) {
  const nextStatus: VendorStatus = row.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
  return (
    <div className="flex flex-wrap gap-1.5">
      <ActionButton label="ویرایش" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" />
      </ActionButton>
      <ActionButton label="دفتر" onClick={onLedger}>
        <BookOpen className="h-3.5 w-3.5" />
      </ActionButton>
      <ActionButton label={nextStatus === 'ACTIVE' ? 'فعال‌سازی' : 'تعلیق'} onClick={() => onStatus(nextStatus)}>
        {nextStatus === 'ACTIVE' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
      </ActionButton>
      <ActionButton label="رمز" onClick={onRotate}>
        <KeyRound className="h-3.5 w-3.5" />
      </ActionButton>
      <ActionButton label="حذف" onClick={onDelete} tone="danger">
        <Trash2 className="h-3.5 w-3.5" />
      </ActionButton>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  tone = 'default',
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium',
        tone === 'danger'
          ? 'border-red-200 text-red-700 hover:bg-red-50'
          : 'border-gray-200 text-gray-700 hover:bg-gray-50',
      )}
    >
      {children}
      {label}
    </button>
  );
}

function LedgerStat({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={cn('rounded-xl px-3 py-3', emphasis ? 'bg-emerald-50' : 'bg-gray-50')}>
      <dt className={cn('text-xs', emphasis ? 'text-emerald-800' : 'text-gray-500')}>{label}</dt>
      <dd className={cn('mt-1 text-sm font-bold tabular-nums', emphasis ? 'text-emerald-950' : 'text-gray-900')}>{value}</dd>
    </div>
  );
}

function DeleteDialog({
  row,
  typed,
  error,
  deleting,
  onTyped,
  onClose,
  onConfirm,
  onSuspend,
}: {
  row: PublicVendor;
  typed: string;
  error: string;
  deleting: boolean;
  onTyped: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onSuspend: () => void;
}) {
  const history = historyParts(usageOf(row));
  const blocked = history.length > 0;
  const nameMatches = typed.trim() === row.name.trim();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/40 p-4 sm:items-center">
      <div role="dialog" aria-modal="true" aria-labelledby="delete-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="delete-title" className="text-lg font-bold text-gray-900">
          حذف «{row.name}»
        </h2>
        {blocked ? (
          <>
            <p className="mt-2 text-sm leading-7 text-gray-600">
              این همکار {history.join('، ')} دارد. حذف، سابقه کالا و تسویه را پاک نمی‌کند. برای قطع ورود، او را معلق کنید.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {row.status !== 'SUSPENDED' && (
                <button type="button" onClick={onSuspend} className="min-h-11 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white">
                  تعلیق به‌جای حذف
                </button>
              )}
              <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm">
                بستن
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-7 text-gray-600">
              حساب ورود و دعوت حذف می‌شود و شماره دوباره قابل استفاده است. برای تأیید، نام همکار را بنویسید.
            </p>
            <label className="mt-4 block text-sm font-medium text-gray-700" htmlFor="delete-name">
              نام همکار
              <input
                id="delete-name"
                className={cn(fieldClass, 'mt-1 font-normal')}
                value={typed}
                onChange={(e) => onTyped(e.target.value)}
                autoComplete="off"
              />
            </label>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={deleting || !nameMatches}
                onClick={onConfirm}
                className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {deleting ? 'در حال حذف…' : 'حذف همکار'}
              </button>
              <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm">
                انصراف
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

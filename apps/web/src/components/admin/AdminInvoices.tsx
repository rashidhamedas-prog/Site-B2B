'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, X, Save, Send, DollarSign, FileText, AlertCircle, Download, Trash2 } from 'lucide-react';
import { Input, Badge, Pagination } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { AdminChannelFilter, type AdminChannel } from './AdminChannelTabs';

interface Invoice {
  id: string;
  invoiceNumber: string;
  type: string;
  status: string;
  subtotal: number;
  total: number;
  paidAmount: number;
  dueDate?: string;
  notes?: string;
  orderId?: string;
  createdAt: string;
  customer?: { id: string; businessName: string; city: string };
  customerId: string;
}

interface Customer { id: string; businessName: string; city: string; }

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT:         { label: 'پیش‌نویس',     color: 'bg-gray-100 text-gray-600' },
  SENT:          { label: 'ارسال شده',     color: 'bg-blue-100 text-blue-700' },
  PAID:          { label: 'پرداخت شده',    color: 'bg-green-100 text-green-700' },
  PARTIALLY_PAID:{ label: 'پرداخت ناقص',  color: 'bg-amber-100 text-amber-700' },
  OVERDUE:       { label: 'معوق',          color: 'bg-red-100 text-red-700' },
  CANCELLED:     { label: 'لغو شده',       color: 'bg-gray-100 text-gray-500' },
};

const TYPE_MAP: Record<string, string> = {
  PROFORMA: 'پیش‌فاکتور',
  FINAL:    'فاکتور نهایی',
};

function toman(n: number) { return Math.round(Number(n) / 10).toLocaleString('fa-IR'); }

// ── Create Modal ─────────────────────────────────────────────────
function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    customerId: '', type: 'PROFORMA', subtotal: '', taxAmount: '0', discount: '0',
    intraCityFee: '0', perKgFee: '0', freeShipping: false, notes: '', dueDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get<{ data: Customer[] }>('/customers?limit=100').then((r) => setCustomers(r.data)).catch(() => {});
  }, []);

  const shippingIrr = form.freeShipping
    ? 0
    : (Number(form.intraCityFee) + Number(form.perKgFee)) * 10;
  const total = (Number(form.subtotal) + Number(form.taxAmount) - Number(form.discount)) * 10 + shippingIrr;

  const handleSave = async () => {
    if (!form.customerId || !form.subtotal) { setError('مشتری و مبلغ الزامی است'); return; }
    setSaving(true); setError('');
    try {
      await apiClient.post('/invoices', {
        customerId: form.customerId,
        type: form.type,
        subtotal: Number(form.subtotal) * 10,
        taxAmount: Number(form.taxAmount) * 10,
        discount: Number(form.discount) * 10,
        intraCityFee: form.freeShipping ? 0 : Number(form.intraCityFee) * 10,
        perKgFee: form.freeShipping ? 0 : Number(form.perKgFee) * 10,
        freeShipping: form.freeShipping,
        total,
        notes: form.notes || undefined,
        dueDate: form.dueDate || undefined,
      });
      onDone(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'خطا'); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  type TextKey = Exclude<keyof typeof form, 'freeShipping'>;
  const fieldCls =
    'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30';
  const f = (key: TextKey, label: string, type = 'text', placeholder = '') => (
    <div className="min-w-0">
      <label className="mb-1.5 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        dir={type === 'number' || type === 'date' ? 'ltr' : undefined}
        className={cn(fieldCls, (type === 'number' || type === 'date') && 'text-left tabular-nums')}
      />
    </div>
  );

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-create-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="بستن"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92dvh,920px)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 id="invoice-create-title" className="text-base font-bold text-gray-900">صدور فاکتور جدید</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100" aria-label="بستن">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">مشتری</label>
            <select
              value={form.customerId}
              onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
              className={fieldCls}
            >
              <option value="">انتخاب مشتری...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName} — {c.city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">نوع فاکتور</label>
            <select
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              className={fieldCls}
            >
              <option value="PROFORMA">پیش‌فاکتور</option>
              <option value="FINAL">فاکتور نهایی</option>
            </select>
          </div>

          {/* One/two columns — never 3: Persian labels overflow */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {f('subtotal', 'مبلغ کالا (تومان)', 'number', '0')}
            {f('taxAmount', 'مالیات (تومان)', 'number', '0')}
            {f('discount', 'تخفیف (تومان)', 'number', '0')}
            {f('dueDate', 'تاریخ سررسید', 'date')}
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="mb-2 text-xs font-semibold text-gray-600">هزینه ارسال</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {f('intraCityFee', 'حمل درون‌شهری (تومان)', 'number', '0')}
              {f('perKgFee', 'کارمزد هر کیلوگرم (تومان)', 'number', '0')}
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.freeShipping}
                onChange={(e) => setForm((p) => ({ ...p, freeShipping: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
              />
              <span className="text-sm text-gray-700">ارسال رایگان</span>
            </label>
          </div>

          <div className="space-y-1 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
            {!form.freeShipping && shippingIrr > 0 && (
              <div className="flex justify-between gap-3 text-xs text-emerald-900">
                <span>هزینه ارسال</span>
                <span className="shrink-0 tabular-nums" dir="ltr">{(shippingIrr / 10).toLocaleString('fa-IR')} تومان</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-emerald-900">جمع کل</span>
              <span className="shrink-0 text-base font-bold tabular-nums text-emerald-800" dir="ltr">
                {(total / 10).toLocaleString('fa-IR')} تومان
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">توضیحات</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className={cn(fieldCls, 'resize-none')}
            />
          </div>
          {error && <p className="text-xs text-error">{error}</p>}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-gray-100 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="btn btn-outline btn-md">
            انصراف
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary btn-md flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'ذخیره...' : 'صدور فاکتور'}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(modal, document.body);
}

// ── Payment Modal ─────────────────────────────────────────────────
function PaymentModal({ invoice, onClose, onDone }: { invoice: Invoice; onClose: () => void; onDone: () => void }) {
  const remaining = Number(invoice.total) - Number(invoice.paidAmount);
  const [amount, setAmount] = useState(String(Math.round(remaining / 10)));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/invoices/${invoice.id}/payment`, { amount: Number(amount) * 10 });
      onDone(); onClose();
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-bold text-gray-900">ثبت پرداخت</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100" aria-label="بستن">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          <div className="space-y-1 rounded-xl bg-gray-50 px-4 py-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">فاکتور</span><span className="font-mono">{invoice.invoiceNumber}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">مجموع</span><span className="font-bold">{toman(invoice.total)} تومان</span></div>
            <div className="flex justify-between"><span className="text-gray-500">پرداخت شده</span><span className="font-bold text-green-600">{toman(invoice.paidAmount)} تومان</span></div>
            <div className="flex justify-between"><span className="text-gray-500">مانده</span><span className="font-bold text-error">{toman(remaining)} تومان</span></div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">مبلغ دریافتی (تومان)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              dir="ltr"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose} className="btn btn-outline btn-md">انصراف</button>
          <button type="button" onClick={handleSave} disabled={saving || !amount} className="btn btn-primary btn-md flex items-center gap-2">
            <DollarSign className="h-4 w-4" />{saving ? 'ذخیره...' : 'ثبت پرداخت'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export function AdminInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<AdminChannel | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) q.set('search', search);
      if (channelFilter !== 'ALL') q.set('channel', channelFilter);
      const res = await apiClient.get<{ data: Invoice[]; meta: typeof meta }>(`/invoices?${q}`);
      setInvoices(res.data);
      setMeta(res.meta);
    } catch {} finally { setLoading(false); }
  }, [page, search, channelFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async (id: string) => {
    setSending(id);
    try { await apiClient.patch(`/invoices/${id}/send`, {}); load(); } catch {} finally { setSending(null); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/invoices/${deleteId}`);
      setDeleteId(null);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در حذف فاکتور');
    } finally {
      setDeleting(false);
    }
  };

  // summary stats
  const totalOutstanding = invoices.reduce((s, i) => s + (Number(i.total) - Number(i.paidAmount)), 0);
  const overdueCount = invoices.filter((i) => i.status === 'OVERDUE').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">فاکتورها</h2>
          <p className="text-sm text-gray-500 mt-0.5">{meta.total} فاکتور ثبت شده</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-md flex items-center gap-2">
          <Plus className="h-4 w-4" />صدور فاکتور
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'کل فاکتورها', value: meta.total, icon: FileText, color: 'bg-primary-50 text-primary' },
          { label: 'مطالبات باز', value: `${toman(totalOutstanding)} ت`, icon: DollarSign, color: 'bg-amber-50 text-amber-600' },
          { label: 'معوق', value: overdueCount, icon: AlertCircle, color: 'bg-red-50 text-red-600' },
          { label: 'پرداخت شده', value: invoices.filter((i) => i.status === 'PAID').length, icon: DollarSign, color: 'bg-green-50 text-green-600' },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', s.color)}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-extrabold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-72">
          <Input placeholder="جستجو شماره یا مشتری..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            rightIcon={<Search className="h-4 w-4" />} />
        </div>
        <AdminChannelFilter
          value={channelFilter}
          onChange={(v) => { setChannelFilter(v); setPage(1); }}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['شماره فاکتور', 'مشتری', 'نوع', 'مجموع', 'پرداخت شده', 'مانده', 'وضعیت', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-20" /></td>
                ))}</tr>
              )) : invoices.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">فاکتوری یافت نشد</td></tr>
              ) : invoices.map((inv) => {
                const remaining = Number(inv.total) - Number(inv.paidAmount);
                const s = STATUS_MAP[inv.status] ?? { label: inv.status, color: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm text-gray-700">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{inv.customer?.businessName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{TYPE_MAP[inv.type] ?? inv.type}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">{toman(inv.total)} ت</td>
                    <td className="px-4 py-3 text-sm text-green-600 whitespace-nowrap">{toman(inv.paidAmount)} ت</td>
                    <td className="px-4 py-3 text-sm text-error whitespace-nowrap">{remaining > 0 ? `${toman(remaining)} ت` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', s.color)}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {inv.status === 'DRAFT' && (
                          <button onClick={() => handleSend(inv.id)} disabled={sending === inv.id}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <Send className="h-3 w-3" />ارسال
                          </button>
                        )}
                        {['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(inv.status) && remaining > 0 && (
                          <button onClick={() => setPayInvoice(inv)}
                            className="text-xs text-green-600 hover:underline flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />پرداخت
                          </button>
                        )}
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/v1/invoices/${inv.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 hover:text-primary flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" />PDF
                        </a>
                        <button
                          type="button"
                          onClick={() => setDeleteId(inv.id)}
                          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                          title="حذف فاکتور"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 border-t border-gray-100">
          <Pagination page={page} totalPages={meta.totalPages} onPageChange={setPage} />
        </div>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onDone={load} />}
      {payInvoice && <PaymentModal invoice={payInvoice} onClose={() => setPayInvoice(null)} onDone={load} />}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <Trash2 className="h-6 w-6 text-error" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-gray-900">حذف فاکتور</h3>
            <p className="mb-6 text-sm text-gray-500">
              فاکتور از لیست حذف می‌شود (soft-delete). این کار را فقط اگر مطمئن هستید انجام دهید.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteId(null)} className="btn btn-outline btn-md flex-1">
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="btn btn-md flex-1 bg-error text-white hover:bg-red-700"
              >
                {deleting ? 'در حال حذف…' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

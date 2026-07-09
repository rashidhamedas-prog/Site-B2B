'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, Plus, X, Save, Send, DollarSign, FileText, AlertCircle, Download } from 'lucide-react';
import { Input, Badge, Pagination } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

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
  const [form, setForm] = useState({ customerId: '', type: 'PROFORMA', subtotal: '', taxAmount: '0', discount: '0', notes: '', dueDate: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get<{ data: Customer[] }>('/customers?limit=100').then((r) => setCustomers(r.data)).catch(() => {});
  }, []);

  const total = (Number(form.subtotal) + Number(form.taxAmount) - Number(form.discount)) * 10;

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
        total,
        notes: form.notes || undefined,
        dueDate: form.dueDate || undefined,
      });
      onDone(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'خطا'); }
    finally { setSaving(false); }
  };

  const f = (key: keyof typeof form, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">صدور فاکتور جدید</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">مشتری</label>
            <select value={form.customerId} onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">انتخاب مشتری...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.businessName} — {c.city}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">نوع فاکتور</label>
            <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="PROFORMA">پیش‌فاکتور</option>
              <option value="FINAL">فاکتور نهایی</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {f('subtotal', 'مبلغ کالا (تومان)', 'number', '0')}
            {f('taxAmount', 'مالیات (تومان)', 'number', '0')}
            {f('discount', 'تخفیف (تومان)', 'number', '0')}
          </div>
          <div className="rounded-xl bg-primary-50 px-4 py-3 flex justify-between">
            <span className="text-sm text-primary-dark">جمع کل</span>
            <span className="text-base font-bold text-primary">{(total / 10).toLocaleString('fa-IR')} تومان</span>
          </div>
          {f('dueDate', 'تاریخ سررسید', 'date')}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">توضیحات</label>
            <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          {error && <p className="text-xs text-error">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn btn-outline btn-md">انصراف</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-md flex items-center gap-2">
            <Save className="h-4 w-4" />{saving ? 'ذخیره...' : 'صدور فاکتور'}
          </button>
        </div>
      </div>
    </div>
  );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">ثبت پرداخت</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-xl bg-gray-50 px-4 py-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">فاکتور</span><span className="font-mono">{invoice.invoiceNumber}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">مجموع</span><span className="font-bold">{toman(invoice.total)} تومان</span></div>
            <div className="flex justify-between"><span className="text-gray-500">پرداخت شده</span><span className="text-green-600 font-bold">{toman(invoice.paidAmount)} تومان</span></div>
            <div className="flex justify-between"><span className="text-gray-500">مانده</span><span className="text-error font-bold">{toman(remaining)} تومان</span></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">مبلغ دریافتی (تومان)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn btn-outline btn-md">انصراف</button>
          <button onClick={handleSave} disabled={saving || !amount} className="btn btn-primary btn-md flex items-center gap-2">
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
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) q.set('search', search);
      const res = await apiClient.get<{ data: Invoice[]; meta: typeof meta }>(`/invoices?${q}`);
      setInvoices(res.data);
      setMeta(res.meta);
    } catch {} finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async (id: string) => {
    setSending(id);
    try { await apiClient.patch(`/invoices/${id}/send`, {}); load(); } catch {} finally { setSending(null); }
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

      <div className="w-72">
        <Input placeholder="جستجو شماره یا مشتری..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          rightIcon={<Search className="h-4 w-4" />} />
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
    </div>
  );
}

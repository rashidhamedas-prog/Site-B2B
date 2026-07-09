'use client';

import { useState, useCallback } from 'react';
import { Search, Plus, Filter, Phone, Edit2, Trash2, X, Save, CheckCircle, XCircle } from 'lucide-react';
import { Input, SegmentBadge, Pagination } from '@/components/ui';
import { useCustomers } from '@/lib/hooks/useCustomers';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

const SEGMENTS = ['همه', 'VIP', 'A', 'B', 'C'];

const emptyForm = {
  businessName: '', ownerName: '', phone: '', phone2: '', email: '',
  province: '', city: '', address: '', postalCode: '',
  nationalId: '', businessType: 'RETAIL', segment: 'C',
  status: 'PENDING', creditLimit: '', notes: '',
};
type FormData = typeof emptyForm;

interface Customer {
  id: string; code: string; businessName: string; ownerName: string;
  phone: string; phone2?: string; email?: string; type: string;
  segment: string; status: string; province: string; city: string;
  address?: string; postalCode?: string; nationalId?: string;
  businessType: string; creditLimit: number; balance: number;
  notes?: string; createdAt: string;
}

export function AdminCustomers() {
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { customers, meta, loading, refetch } = useCustomers({
    page, search: search || undefined, segment: segment || undefined,
  });

  const openCreate = () => { setForm(emptyForm); setEditCustomer(null); setModal('create'); };
  const openEdit = (c: Customer) => {
    setEditCustomer(c);
    setForm({
      businessName: c.businessName, ownerName: c.ownerName, phone: c.phone,
      phone2: c.phone2 ?? '', email: c.email ?? '', province: c.province,
      city: c.city, address: c.address ?? '', postalCode: c.postalCode ?? '',
      nationalId: c.nationalId ?? '', businessType: c.businessType,
      segment: c.segment, status: c.status,
      creditLimit: c.creditLimit ? String(Number(c.creditLimit) / 10) : '',
      notes: c.notes ?? '',
    });
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setEditCustomer(null); };

  const handleSave = useCallback(async () => {
    if (!form.businessName || !form.ownerName || !form.phone || !form.province || !form.city) return;
    setSaving(true);
    try {
      const payload = { ...form, creditLimit: form.creditLimit ? Number(form.creditLimit) * 10 : 0 };
      if (modal === 'create') await apiClient.post('/customers', payload);
      else if (modal === 'edit' && editCustomer) await apiClient.patch(`/customers/${editCustomer.id}`, payload);
      closeModal(); refetch();
    } finally { setSaving(false); }
  }, [form, modal, editCustomer, refetch]);

  const handleDelete = useCallback(async (id: string) => {
    try { await apiClient.delete(`/customers/${id}`); setDeleteId(null); refetch(); } catch {}
  }, [refetch]);

  const handleActivate = useCallback(async (id: string, active: boolean) => {
    await apiClient.patch(`/customers/${id}`, { status: active ? 'ACTIVE' : 'INACTIVE' });
    refetch();
  }, [refetch]);

  const f = (key: keyof FormData, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={form[key] as string}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
    </div>
  );

  const sel = (key: keyof FormData, label: string, options: Array<{ value: string; label: string }>) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select value={form[key] as string} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">مشتریان (CRM)</h2>
          <p className="text-sm text-gray-500 mt-0.5">{meta.total} مشتری ثبت شده</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary btn-md flex items-center gap-2">
          <Plus className="h-4 w-4" />افزودن مشتری
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="w-72">
          <Input placeholder="جستجو نام، کد، شهر..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            rightIcon={<Search className="h-4 w-4" />} />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-gray-400" />
          {SEGMENTS.map((s) => (
            <button key={s} onClick={() => { setSegment(s === 'همه' ? '' : s); setPage(1); }}
              className={cn('px-3 py-1 rounded-full text-xs font-medium transition-colors',
                (s === 'همه' ? segment === '' : segment === s) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['کد', 'نام فروشگاه', 'صاحب', 'شهر', 'سگمنت', 'وضعیت', 'مانده', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-20" /></td>
                  ))}</tr>
                ))
              ) : customers.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center">
                  <p className="text-gray-400 mb-3">مشتری‌ای یافت نشد</p>
                  <button onClick={openCreate} className="btn btn-primary btn-sm">ثبت اولین مشتری</button>
                </td></tr>
              ) : (customers as Customer[]).map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-gray-400">{c.code}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{c.businessName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.ownerName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.city}</td>
                  <td className="px-4 py-3"><SegmentBadge segment={c.segment} /></td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                      c.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500')}>
                      {c.status === 'ACTIVE' ? 'فعال' : c.status === 'PENDING' ? 'در انتظار' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className={cn('px-4 py-3 text-sm font-bold', Number(c.balance) < 0 ? 'text-error' : 'text-gray-400')}>
                    {Number(c.balance) < 0 ? `${(Math.abs(Number(c.balance)) / 10).toLocaleString('fa-IR')} ت` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {c.status === 'PENDING' && (
                        <button onClick={() => handleActivate(c.id, true)} className="text-success hover:opacity-80" title="فعال کردن">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      {c.status === 'ACTIVE' && (
                        <button onClick={() => handleActivate(c.id, false)} className="text-gray-400 hover:text-error" title="غیرفعال کردن">
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                      <a href={`tel:${c.phone}`} className="text-gray-400 hover:text-primary"><Phone className="h-4 w-4" /></a>
                      <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-primary"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteId(c.id)} className="text-gray-400 hover:text-error"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 border-t border-gray-100">
          <Pagination page={page} totalPages={meta.totalPages} onPageChange={setPage} />
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {modal === 'create' ? 'ثبت مشتری جدید' : 'ویرایش اطلاعات مشتری'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {f('businessName', 'نام فروشگاه/مجموعه *', 'text', 'بوتیک گل رز')}
                {f('ownerName', 'نام صاحب *', 'text', 'محمد احمدی')}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {f('phone', 'موبایل اصلی *', 'tel', '09120000000')}
                {f('phone2', 'موبایل دوم', 'tel', '09130000000')}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {f('email', 'ایمیل', 'email', 'info@example.com')}
                {f('nationalId', 'کد ملی / شناسه ملی', 'text', '0012345678')}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {f('province', 'استان *', 'text', 'تهران')}
                {f('city', 'شهر *', 'text', 'تهران')}
              </div>
              <div>{f('address', 'آدرس', 'text', 'خیابان ولیعصر...')}</div>
              <div className="grid grid-cols-3 gap-4">
                {f('postalCode', 'کد پستی', 'text', '1234567890')}
                {sel('businessType', 'نوع کسب‌وکار', [
                  { value: 'RETAIL', label: 'خرده‌فروش' }, { value: 'WHOLESALE', label: 'عمده‌فروش' },
                  { value: 'ONLINE', label: 'آنلاین' }, { value: 'BOUTIQUE', label: 'بوتیک' },
                ])}
                {f('creditLimit', 'سقف اعتبار (تومان)', 'number', '5000000')}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {sel('segment', 'سگمنت', [
                  { value: 'VIP', label: 'VIP' }, { value: 'A', label: 'A' },
                  { value: 'B', label: 'B' }, { value: 'C', label: 'C' },
                ])}
                {sel('status', 'وضعیت', [
                  { value: 'PENDING', label: 'در انتظار تأیید' },
                  { value: 'ACTIVE', label: 'فعال' },
                  { value: 'INACTIVE', label: 'غیرفعال' },
                ])}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">یادداشت</label>
                <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeModal} className="btn btn-outline btn-md">انصراف</button>
              <button onClick={handleSave}
                disabled={saving || !form.businessName || !form.ownerName || !form.phone || !form.province || !form.city}
                className="btn btn-primary btn-md flex items-center gap-2">
                <Save className="h-4 w-4" />{saving ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-6 w-6 text-error" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">حذف مشتری</h3>
            <p className="text-sm text-gray-500 mb-6">تمام اطلاعات این مشتری حذف خواهد شد.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 btn btn-outline btn-md">انصراف</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 btn btn-md bg-error text-white hover:bg-red-700">حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

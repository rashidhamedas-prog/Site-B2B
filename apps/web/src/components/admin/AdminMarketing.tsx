'use client';

import { useState, useCallback, useEffect } from 'react';
import { Tag, Plus, Trash2, Copy, X, Save, Check, Layers, Gift } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fromJalaliString, toJalaliString, toJalaliDateTimeString } from '@taranom/persian-utils';

interface DiscountCode {
  id: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minOrder?: number;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  startsAt?: string;
  expiresAt?: string;
}

interface TierLevel { minAmount: string; percent: string }
interface TieredDiscount {
  id: string;
  levels: Array<{ minAmount: number; percent: number }>;
  expiresAt?: string;
  isActive: boolean;
}

type SideType = 'FIRST_INVOICE' | 'INVOICE_COUNT' | 'INVOICE_SUM' | 'PRODUCT_COUNT';

interface SideDiscount {
  id: string;
  type: SideType;
  percent: number;
  threshold: number;
  categoryId?: string;
  isActive: boolean;
}

const SIDE_LABELS: Record<SideType, string> = {
  FIRST_INVOICE: 'تخفیف اولین فاکتور',
  INVOICE_COUNT: 'تخفیف بر اساس تعداد فاکتور',
  INVOICE_SUM: 'تخفیف بر اساس جمع مبالغ فاکتورها',
  PRODUCT_COUNT: 'تخفیف بر اساس تعداد محصولات خریداری‌شده',
};

const emptyCode = {
  code: '', type: 'PERCENT' as const, value: '', minOrder: '', maxUses: '',
  startsAt: '', expiresAt: '', isActive: true,
};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function jalaliInputToIso(v: string): string | undefined {
  if (!v.trim()) return undefined;
  const d = fromJalaliString(v.trim());
  return d ? d.toISOString() : undefined;
}

function isoToJalaliInput(iso?: string): string {
  if (!iso) return '';
  try { return toJalaliDateTimeString(iso); } catch {
    try { return toJalaliString(iso); } catch { return ''; }
  }
}

type Tab = 'codes' | 'tiered' | 'side';

export function AdminMarketing() {
  const [tab, setTab] = useState<Tab>('codes');
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [tiers, setTiers] = useState<TieredDiscount[]>([]);
  const [sides, setSides] = useState<SideDiscount[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...emptyCode });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [tierLevels, setTierLevels] = useState<TierLevel[]>([{ minAmount: '', percent: '' }]);
  const [tierExpires, setTierExpires] = useState('');
  const [tierModal, setTierModal] = useState(false);

  const [sideForm, setSideForm] = useState({
    type: 'FIRST_INVOICE' as SideType, percent: '', threshold: '', categoryId: '', isActive: true,
  });
  const [sideModal, setSideModal] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [c, t, s, cats] = await Promise.all([
        apiClient.get<DiscountCode[]>('/discount-codes').catch(() => []),
        apiClient.get<TieredDiscount[]>('/discount-codes/tiered/list').catch(() => []),
        apiClient.get<SideDiscount[]>('/discount-codes/side/list').catch(() => []),
        apiClient.get<Array<{ id: string; name: string }>>('/categories').catch(() => []),
      ]);
      setCodes(c ?? []);
      setTiers(t ?? []);
      setSides(s ?? []);
      setCategories(cats ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (id: string) => {
    await apiClient.delete(`/discount-codes/${id}`).catch(() => {});
    setCodes((prev) => prev.filter((c) => c.id !== id));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleSaveCode = useCallback(async () => {
    if (!form.code || !form.value) return;
    setSaving(true);
    try {
      const created = await apiClient.post<DiscountCode>('/discount-codes', {
        code: form.code,
        type: form.type,
        value: form.type === 'PERCENT' ? Number(form.value) : Number(form.value) * 10,
        minOrder: form.minOrder ? Number(form.minOrder) * 10 : 0,
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        startsAt: jalaliInputToIso(form.startsAt),
        expiresAt: jalaliInputToIso(form.expiresAt),
        isActive: form.isActive,
      });
      setCodes((prev) => [created, ...prev]);
      setModal(false);
      setForm({ ...emptyCode });
    } catch {
      alert('ذخیره کد تخفیف ناموفق بود');
    } finally {
      setSaving(false);
    }
  }, [form]);

  const handleSaveTier = async () => {
    const levels = tierLevels
      .filter((l) => l.minAmount && l.percent)
      .map((l) => ({ minAmount: Number(l.minAmount) * 10, percent: Number(l.percent) }));
    if (!levels.length) return;
    setSaving(true);
    try {
      const created = await apiClient.post<TieredDiscount>('/discount-codes/tiered', {
        levels,
        expiresAt: jalaliInputToIso(tierExpires),
        isActive: true,
      });
      setTiers((prev) => [created, ...prev]);
      setTierModal(false);
      setTierLevels([{ minAmount: '', percent: '' }]);
      setTierExpires('');
    } catch {
      alert('ذخیره تخفیف طبقاتی ناموفق بود');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSide = async () => {
    if (!sideForm.percent) return;
    setSaving(true);
    try {
      const thresholdToman = Number(sideForm.threshold) || 0;
      const threshold = sideForm.type === 'INVOICE_SUM' ? thresholdToman * 10 : thresholdToman;
      const created = await apiClient.post<SideDiscount>('/discount-codes/side', {
        type: sideForm.type,
        percent: Number(sideForm.percent),
        threshold,
        categoryId: sideForm.categoryId || undefined,
        isActive: sideForm.isActive,
      });
      setSides((prev) => [created, ...prev]);
      setSideModal(false);
      setSideForm({ type: 'FIRST_INVOICE', percent: '', threshold: '', categoryId: '', isActive: true });
    } catch {
      alert('ذخیره تخفیف جانبی ناموفق بود');
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof Tag }[] = [
    { id: 'codes', label: 'کد تخفیف', icon: Tag },
    { id: 'tiered', label: 'تخفیفات طبقاتی', icon: Layers },
    { id: 'side', label: 'تخفیفات جانبی', icon: Gift },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">تخفیف‌ها</h2>
        <p className="text-sm text-gray-500 mt-0.5">کد تخفیف، تخفیف طبقاتی و تخفیف جانبی</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('btn btn-sm flex items-center gap-1.5', tab === t.id ? 'btn-primary' : 'btn-outline')}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'codes' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">کدهای تخفیف</h3>
            <button onClick={() => setModal(true)} className="btn btn-primary btn-sm flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />ایجاد کد
            </button>
          </div>
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">در حال بارگذاری...</div>
          ) : codes.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <p className="text-sm">کدی تعریف نشده</p>
              <button onClick={() => setModal(true)} className="btn btn-primary btn-sm mt-3">ایجاد اولین کد</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-gray-50">
                  <tr>{['کد', 'نوع', 'مقدار', 'شروع', 'انقضا', 'استفاده', 'وضعیت', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {codes.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm">{c.code}</span>
                          <button onClick={() => copyCode(c.code)} className="text-gray-400 hover:text-primary">
                            {copied === c.code ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.type === 'PERCENT' ? 'درصد' : 'مبلغ'}</td>
                      <td className="px-4 py-3 text-sm font-bold">
                        {c.type === 'PERCENT' ? `${c.value}%` : `${(c.value / 10).toLocaleString('fa-IR')} ت`}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{isoToJalaliInput(c.startsAt) || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{isoToJalaliInput(c.expiresAt) || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.usedCount} / {c.maxUses ?? '∞'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                          c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                          {c.isActive ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-error"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'tiered' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900">تخفیفات طبقاتی</h3>
              <p className="text-xs text-gray-400 mt-0.5">بدون کد — بر اساس مبلغ سفارش به‌صورت خودکار</p>
            </div>
            <button onClick={() => setTierModal(true)} className="btn btn-primary btn-sm flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />افزودن
            </button>
          </div>
          {tiers.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">سطح تخفیفی تعریف نشده</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {tiers.map((t) => (
                <div key={t.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    {(t.levels ?? []).map((l, i) => (
                      <p key={i} className="text-sm text-gray-700">
                        از {(l.minAmount / 10).toLocaleString('fa-IR')} تومان — {l.percent}٪ تخفیف
                      </p>
                    ))}
                    <p className="text-xs text-gray-400">انقضا: {isoToJalaliInput(t.expiresAt) || 'ندارد'}</p>
                  </div>
                  <button onClick={async () => {
                    await apiClient.delete(`/discount-codes/tiered/${t.id}`).catch(() => {});
                    setTiers((prev) => prev.filter((x) => x.id !== t.id));
                  }} className="text-gray-400 hover:text-error"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'side' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900">تخفیفات جانبی</h3>
              <p className="text-xs text-gray-400 mt-0.5">بر اساس سابقه فاکتور و خرید مشتری</p>
            </div>
            <button onClick={() => setSideModal(true)} className="btn btn-primary btn-sm flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />اضافه کردن تخفیف
            </button>
          </div>
          {sides.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">تخفیف جانبی تعریف نشده</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sides.map((s) => (
                <div key={s.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{SIDE_LABELS[s.type]}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{s.percent}٪
                      {s.type !== 'FIRST_INVOICE' && (
                        <> — آستانه: {s.type === 'INVOICE_SUM'
                          ? `${(Number(s.threshold) / 10).toLocaleString('fa-IR')} تومان`
                          : Number(s.threshold).toLocaleString('fa-IR')}</>
                      )}
                    </p>
                    {s.categoryId && (
                      <p className="text-xs text-gray-400 mt-1">
                        دسته: {categories.find((c) => c.id === s.categoryId)?.name ?? s.categoryId}
                      </p>
                    )}
                  </div>
                  <button onClick={async () => {
                    await apiClient.delete(`/discount-codes/side/${s.id}`).catch(() => {});
                    setSides((prev) => prev.filter((x) => x.id !== s.id));
                  }} className="text-gray-400 hover:text-error"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">ایجاد کد تخفیف</h3>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">کد تخفیف</label>
                <div className="flex gap-2">
                  <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="TARANOM20" maxLength={20}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, code: generateCode() }))}
                    className="btn btn-outline btn-sm px-3">تصادفی</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">نوع</label>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none">
                    <option value="PERCENT">درصد تخفیف</option>
                    <option value="FIXED">مبلغ ثابت (تومان)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {form.type === 'PERCENT' ? 'درصد (%)' : 'مبلغ (تومان)'}
                  </label>
                  <input type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">حداقل سفارش (تومان)</label>
                  <input type="number" value={form.minOrder} onChange={(e) => setForm((f) => ({ ...f, minOrder: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">حداکثر استفاده</label>
                  <input type="number" value={form.maxUses} onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">تاریخ و ساعت شروع (شمسی)</label>
                  <input value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                    placeholder="1405/04/01 00:00"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">تاریخ و ساعت انقضا (شمسی)</label>
                  <input value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                    placeholder="1405/12/29 23:59"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <p className="text-[11px] text-gray-400">فرمت: سال/ماه/روز ساعت:دقیقه — مثلاً ۱۴۰۵/۰۴/۲۶ ۲۳:۵۹</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <span className="text-sm text-gray-700">کد فعال باشد</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setModal(false)} className="btn btn-outline btn-md">انصراف</button>
              <button onClick={handleSaveCode} disabled={saving || !form.code || !form.value}
                className="btn btn-primary btn-md flex items-center gap-2">
                <Save className="h-4 w-4" />{saving ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">تخفیف طبقاتی</h3>
              <button onClick={() => setTierModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {tierLevels.map((l, i) => (
                <div key={i} className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">حداقل سفارش سطح {i + 1} (تومان)</label>
                    <input type="number" value={l.minAmount}
                      onChange={(e) => setTierLevels((prev) => prev.map((x, idx) => idx === i ? { ...x, minAmount: e.target.value } : x))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">درصد تخفیف سطح {i + 1}</label>
                    <input type="number" value={l.percent}
                      onChange={(e) => setTierLevels((prev) => prev.map((x, idx) => idx === i ? { ...x, percent: e.target.value } : x))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setTierLevels((p) => [...p, { minAmount: '', percent: '' }])}
                className="btn btn-outline btn-sm">+ سطح بعدی</button>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">تاریخ و ساعت انقضا (شمسی)</label>
                <input value={tierExpires} onChange={(e) => setTierExpires(e.target.value)} placeholder="1405/12/29 23:59"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <p className="text-[11px] text-gray-400 mt-1">مثال: ۱۴۰۵/۱۲/۲۹ ۲۳:۵۹</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setTierModal(false)} className="btn btn-outline btn-md">انصراف</button>
              <button onClick={handleSaveTier} disabled={saving} className="btn btn-primary btn-md flex items-center gap-2">
                <Save className="h-4 w-4" />{saving ? '...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">تخفیف جانبی</h3>
              <button onClick={() => setSideModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">نوع تخفیف</label>
                <select value={sideForm.type} onChange={(e) => setSideForm((f) => ({ ...f, type: e.target.value as SideType }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none">
                  {(Object.keys(SIDE_LABELS) as SideType[]).map((k) => (
                    <option key={k} value={k}>{SIDE_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">میزان درصد تخفیف</label>
                <input type="number" value={sideForm.percent}
                  onChange={(e) => setSideForm((f) => ({ ...f, percent: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {sideForm.type === 'INVOICE_COUNT' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">حداقل تعداد فاکتور</label>
                  <input type="number" value={sideForm.threshold}
                    onChange={(e) => setSideForm((f) => ({ ...f, threshold: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              )}
              {sideForm.type === 'INVOICE_SUM' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">حداقل جمع فاکتورها (تومان)</label>
                  <input type="number" value={sideForm.threshold}
                    onChange={(e) => setSideForm((f) => ({ ...f, threshold: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              )}
              {sideForm.type === 'PRODUCT_COUNT' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">حداقل تعداد محصولات خریداری‌شده</label>
                  <input type="number" value={sideForm.threshold}
                    onChange={(e) => setSideForm((f) => ({ ...f, threshold: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">دسته‌بندی محصول (اختیاری)</label>
                <select value={sideForm.categoryId}
                  onChange={(e) => setSideForm((f) => ({ ...f, categoryId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none">
                  <option value="">همه دسته‌ها</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setSideModal(false)} className="btn btn-outline btn-md">انصراف</button>
              <button onClick={handleSaveSide} disabled={saving || !sideForm.percent}
                className="btn btn-primary btn-md flex items-center gap-2">
                <Save className="h-4 w-4" />{saving ? '...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

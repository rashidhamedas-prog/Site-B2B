'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Search, Package, AlertTriangle, XCircle, TrendingUp,
  Plus, Minus, RefreshCw, X, Save, History, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

// ── Types ──────────────────────────────────────────────────────

interface Variant {
  id: string;
  color: string;
  colorHex: string;
  size: string;
  stock: number;
  barcode?: string;
}

interface StockProduct {
  id: string;
  sku: string;
  name: string;
  fabric: string;
  status: string;
  wholesalePrice: number;
  totalStock: number;
  variants: Variant[];
}

interface Summary {
  totalProducts: number;
  totalUnits: number;
  lowStock: number;
  zeroStock: number;
  totalMovements: number;
}

interface Movement {
  id: string;
  productVariantId: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

// ── Hook ───────────────────────────────────────────────────────

function useInventory(filter: string, search: string, page: number) {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: '40' });
      if (search) q.set('search', search);
      if (filter !== 'ALL') q.set('filter', filter);
      const res = await apiClient.get<{ data: StockProduct[]; meta: typeof meta }>(`/inventory/stock?${q}`);
      setProducts(res.data);
      setMeta(res.meta);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [filter, search, page]);

  useEffect(() => { fetch(); }, [fetch]);
  return { products, meta, loading, refetch: fetch };
}

function useSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const fetch = useCallback(async () => {
    try {
      const res = await apiClient.get<Summary>('/inventory/summary');
      setSummary(res);
    } catch {}
  }, []);
  useEffect(() => { fetch(); }, [fetch]);
  return { summary, refetch: fetch };
}

// ── Adjust Modal ───────────────────────────────────────────────

const TYPES = [
  { value: 'IN',     label: 'ورود به انبار', icon: Plus,       color: 'text-green-600' },
  { value: 'OUT',    label: 'خروج از انبار',  icon: Minus,      color: 'text-red-600' },
  { value: 'ADJUST', label: 'تصحیح موجودی',  icon: RefreshCw,  color: 'text-blue-600' },
  { value: 'RETURN', label: 'مرجوعی',         icon: TrendingUp, color: 'text-amber-600' },
  { value: 'DAMAGE', label: 'ضایعات',         icon: XCircle,    color: 'text-gray-500' },
];

function AdjustModal({ variant, productName, onClose, onDone }: {
  variant: Variant; productName: string; onClose: () => void; onDone: () => void;
}) {
  const [type, setType] = useState('IN');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const quantity = parseInt(qty, 10);
    if (!quantity || quantity < 1) { setError('مقدار باید عدد مثبت باشد'); return; }
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/inventory/adjust', {
        productVariantId: variant.id,
        quantity,
        type,
        notes: notes || undefined,
      });
      onDone();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در ذخیره');
    } finally {
      setSaving(false);
    }
  };

  const stockAfter = () => {
    const q = parseInt(qty, 10) || 0;
    if (type === 'IN' || type === 'RETURN') return variant.stock + q;
    if (type === 'OUT' || type === 'DAMAGE') return Math.max(0, variant.stock - q);
    if (type === 'ADJUST') return q;
    return variant.stock;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">تعدیل موجودی</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {productName} — {variant.color} / {variant.size}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Current stock */}
          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-600">موجودی فعلی</span>
            <span className="text-lg font-bold text-gray-900">{variant.stock} عدد</span>
          </div>

          {/* Type */}
          <div className="grid grid-cols-5 gap-1.5">
            {TYPES.map((t) => (
              <button key={t.value} onClick={() => setType(t.value)}
                className={cn('flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-all',
                  type === t.value ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300')}>
                <t.icon className={cn('h-4 w-4', type === t.value ? 'text-primary' : t.color)} />
                <span className="text-[10px] text-center leading-tight">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {type === 'ADJUST' ? 'موجودی جدید (عدد دقیق)' : 'تعداد'}
            </label>
            <input
              type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Preview */}
          {qty && !isNaN(parseInt(qty)) && (
            <div className="flex items-center justify-between rounded-xl bg-primary-50 px-4 py-3 border border-primary-100">
              <span className="text-sm text-primary-dark">موجودی بعد از تعدیل</span>
              <span className={cn('text-lg font-bold', stockAfter() === 0 ? 'text-error' : stockAfter() < 5 ? 'text-warning' : 'text-success')}>
                {stockAfter()} عدد
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">توضیحات (اختیاری)</label>
            <input
              type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="مثلاً: رسید انبار شماره ۴۵"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {error && <p className="text-xs text-error">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn btn-outline btn-md">انصراف</button>
          <button onClick={handleSave} disabled={saving || !qty}
            className="btn btn-primary btn-md flex items-center gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'در حال ذخیره...' : 'ثبت تعدیل'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Movement History Modal ─────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  IN:     { label: 'ورودی',    color: 'bg-green-100 text-green-700' },
  OUT:    { label: 'خروجی',    color: 'bg-red-100 text-red-700' },
  ADJUST: { label: 'تصحیح',   color: 'bg-blue-100 text-blue-700' },
  RETURN: { label: 'مرجوعی',  color: 'bg-amber-100 text-amber-700' },
  DAMAGE: { label: 'ضایعات',  color: 'bg-gray-100 text-gray-600' },
  SALE:   { label: 'فروش',    color: 'bg-purple-100 text-purple-700' },
};

function HistoryModal({ onClose }: { onClose: () => void }) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<{ data: Movement[] }>('/inventory/movements?limit=50')
      .then((r) => setMovements(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            تاریخچه تحرکات انبار
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center text-gray-400">در حال بارگذاری...</div>
          ) : movements.length === 0 ? (
            <div className="p-8 text-center text-gray-400">تحرکی ثبت نشده است</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  {['نوع', 'تعداد', 'موجودی بعد', 'توضیحات', 'تاریخ'].map((h) => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {movements.map((m) => {
                  const tInfo = TYPE_LABELS[m.type] ?? { label: m.type, color: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', tInfo.color)}>
                          {tInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium">{m.quantity}</td>
                      <td className="px-4 py-3 font-mono">{m.balanceAfter}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{m.notes || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleDateString('fa-IR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Stock Badge ────────────────────────────────────────────────

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <span className="inline-flex items-center gap-1 text-xs font-bold text-error"><XCircle className="h-3 w-3" />اتمام</span>;
  if (stock < 5)   return <span className="inline-flex items-center gap-1 text-xs font-bold text-warning"><AlertTriangle className="h-3 w-3" />{stock}</span>;
  return <span className="text-sm font-bold text-success">{stock}</span>;
}

// ── Main Component ─────────────────────────────────────────────

export function AdminInventory() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [adjustTarget, setAdjustTarget] = useState<{ variant: Variant; productName: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { products, meta, loading, refetch } = useInventory(filter, search, page);
  const { summary, refetch: refetchSummary } = useSummary();

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleDone = () => { refetch(); refetchSummary(); };

  const FILTERS = [
    { key: 'ALL', label: 'همه' },
    { key: 'LOW', label: `کم موجودی${summary ? ` (${summary.lowStock})` : ''}` },
    { key: 'ZERO', label: `اتمام موجودی${summary ? ` (${summary.zeroStock})` : ''}` },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">مدیریت انبار</h2>
          <p className="text-sm text-gray-500 mt-0.5">موجودی محصولات و واریانت‌ها</p>
        </div>
        <button onClick={() => setShowHistory(true)}
          className="btn btn-outline btn-md flex items-center gap-2">
          <History className="h-4 w-4" />
          تاریخچه تحرکات
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'کل محصولات', value: summary?.totalProducts ?? '—', icon: Package, color: 'bg-primary-50 text-primary' },
          { label: 'کل واحد موجود', value: summary?.totalUnits ?? '—', icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
          { label: 'کم موجودی', value: summary?.lowStock ?? '—', icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
          { label: 'اتمام موجودی', value: summary?.zeroStock ?? '—', icon: XCircle, color: 'bg-red-50 text-red-600' },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-4">
            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', s.color)}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <Input placeholder="جستجو نام یا SKU..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            rightIcon={<Search className="h-4 w-4" />} />
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); }}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filter === f.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => { refetch(); refetchSummary(); }}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-primary transition-colors" title="بازخوانی">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Products Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">در حال بارگذاری...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">محصولی یافت نشد</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {products.map((product) => {
              const isOpen = expanded.has(product.id);
              return (
                <div key={product.id}>
                  {/* Product row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => toggleExpand(product.id)}
                  >
                    <button className="text-gray-400 flex-shrink-0">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">{product.sku}</span>
                        <span className="text-sm font-semibold text-gray-900 truncate">{product.name}</span>
                        <span className="hidden sm:inline text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{product.fabric}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{product.variants.length} واریانت</p>
                    </div>

                    {/* Total stock */}
                    <div className="text-left flex-shrink-0 min-w-[80px]">
                      <p className="text-xs text-gray-400 mb-0.5">کل موجودی</p>
                      <StockBadge stock={product.totalStock} />
                    </div>

                    {/* Stock bar */}
                    <div className="hidden md:flex items-center gap-1 flex-shrink-0 w-32">
                      {product.variants.slice(0, 8).map((v) => (
                        <div key={v.id} title={`${v.color}/${v.size}: ${v.stock}`}
                          className={cn('h-6 flex-1 rounded text-[9px] font-bold flex items-center justify-center text-white transition-all',
                            v.stock === 0 ? 'bg-red-400' : v.stock < 5 ? 'bg-amber-400' : 'bg-green-500')}>
                          {v.stock}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expanded variants */}
                  {isOpen && (
                    <div className="bg-gray-50 border-t border-gray-100">
                      <div className="px-8 py-3 overflow-x-auto">
                        <table className="w-full min-w-[500px] text-sm">
                          <thead>
                            <tr>
                              {['رنگ', 'سایز', 'موجودی', 'بارکد', ''].map((h) => (
                                <th key={h} className="px-3 py-2 text-right text-xs font-semibold text-gray-400">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {product.variants.map((v) => (
                              <tr key={v.id} className="hover:bg-white transition-colors">
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="h-4 w-4 rounded-full border border-gray-200 flex-shrink-0"
                                      style={{ backgroundColor: v.colorHex || '#ccc' }} />
                                    <span className="text-gray-700">{v.color}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-gray-700">{v.size}</td>
                                <td className="px-3 py-2"><StockBadge stock={v.stock} /></td>
                                <td className="px-3 py-2 font-mono text-xs text-gray-400">{v.barcode || '—'}</td>
                                <td className="px-3 py-2">
                                  <button
                                    onClick={() => setAdjustTarget({ variant: v, productName: product.name })}
                                    className="text-xs text-primary hover:underline font-medium">
                                    تعدیل
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {product.variants.length === 0 && (
                          <p className="text-xs text-gray-400 py-2 text-center">واریانتی تعریف نشده — از بخش محصولات اضافه کنید</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-gray-100">
            {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className={cn('h-8 w-8 rounded-lg text-sm font-medium transition-colors',
                  p === page ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100')}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {adjustTarget && (
        <AdjustModal
          variant={adjustTarget.variant}
          productName={adjustTarget.productName}
          onClose={() => setAdjustTarget(null)}
          onDone={handleDone}
        />
      )}

      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
    </div>
  );
}

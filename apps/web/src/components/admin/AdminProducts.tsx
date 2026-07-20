'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, X, Save, Layers, ImagePlus, Loader2, Package } from 'lucide-react';
import { Input, Badge, Pagination } from '@/components/ui';
import { useProducts, Product, ProductSpecs, ProductCustomField } from '@/lib/hooks/useProducts';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'فعال',
  ARCHIVED: 'بایگانی',
  OUT_OF_STOCK: 'ناموجود',
  COMING_SOON: 'به زودی',
};

const SIZE_TYPE_LABELS: Record<string, string> = {
  TWO: 'محصول ۲ سایزی',
  THREE: 'محصول ۳ سایزی',
  FREE: 'فری سایز',
};

const COMMON_COLORS: Array<{ name: string; hex: string }> = [
  { name: 'سفید', hex: '#FFFFFF' },
  { name: 'مشکی', hex: '#000000' },
  { name: 'کرم', hex: '#F5F0E6' },
  { name: 'بژ', hex: '#D4A574' },
  { name: 'سرمه‌ای', hex: '#1B2A4A' },
  { name: 'خاکستری', hex: '#808080' },
  { name: 'قهوه‌ای', hex: '#8B4513' },
  { name: 'زرشکی', hex: '#800020' },
  { name: 'زیتونی', hex: '#556B2F' },
  { name: 'آبی', hex: '#3B82F6' },
  { name: 'صورتی', hex: '#F9A8D4' },
  { name: 'خردلی', hex: '#D4A017' },
];

type SpecMemory = Record<string, string[]>;

interface ColorHistoryItem {
  id?: string;
  name: string;
  hex?: string | null;
}

const emptySpecs: ProductSpecs = {
  fabricType: '',
  packQty: '',
  length: '',
  length2: '',
  chestWidth: '',
  sleeveModel: '',
  buttonModel: '',
  collarModel: '',
  customFields: [],
};

const emptyForm = {
  sku: '',
  categoryId: '',
  name: '',
  description: '',
  wholesalePrice: '',
  retailPrice: '',
  minOrderQty: '5',
  status: 'ACTIVE',
  isDiscounted: false,
  sizeType: 'FREE' as 'TWO' | 'THREE' | 'FREE',
  specs: emptySpecs,
  hasLength2: false,
};

const emptyVariantForm = { color: '', colorHex: '#000000', barcode: '' };

type FormData = typeof emptyForm;
type VariantForm = typeof emptyVariantForm;

interface Variant {
  id: string;
  color: string;
  colorHex: string;
  size: string;
  stock: number;
  barcode?: string;
}

function MemoryChips({
  values,
  onPick,
}: {
  values?: string[];
  onPick: (v: string) => void;
}) {
  if (!values?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {values.slice(0, 12).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-primary-50 hover:text-primary transition-colors"
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function VariantsModal({
  product,
  onClose,
  onDone,
}: {
  product: Product;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<VariantForm>(emptyVariantForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>(product.variants ?? []);
  const [colorHistory, setColorHistory] = useState<ColorHistoryItem[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sizeLabel = SIZE_TYPE_LABELS[product.sizeType || 'FREE'] || SIZE_TYPE_LABELS.FREE;

  useEffect(() => {
    apiClient
      .get<ColorHistoryItem[]>('/products/meta/colors')
      .then((res) => setColorHistory(Array.isArray(res) ? res : []))
      .catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    const res = await apiClient.get<{ variants: Variant[] }>(`/products/${product.id}`);
    setVariants((res as { variants?: Variant[] }).variants ?? []);
    onDone();
  }, [product.id, onDone]);

  const startEdit = (v: Variant) => {
    setEditId(v.id);
    setSaveError(null);
    setForm({
      color: v.color,
      colorHex: v.colorHex || '#000000',
      barcode: v.barcode ?? '',
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setSaveError(null);
    setForm(emptyVariantForm);
  };

  const pickColor = (name: string, hex: string) => {
    setForm((p) => ({ ...p, color: name, colorHex: hex || p.colorHex }));
  };

  // Color definition only — inventory is managed exclusively in Admin Inventory.
  const handleSave = async () => {
    if (!form.color) return;
    setSaveError(null);
    setSaving(true);
    try {
      if (editId) {
        await apiClient.patch(`/products/${product.id}/variants/${editId}`, {
          color: form.color,
          colorHex: form.colorHex,
          barcode: form.barcode || undefined,
        });
      } else {
        await apiClient.post(`/products/${product.id}/variants`, {
          color: form.color,
          colorHex: form.colorHex,
          barcode: form.barcode || undefined,
          size: sizeLabel,
        });
      }
      setEditId(null);
      setForm(emptyVariantForm);
      await refresh();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'خطا در ذخیره رنگ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (variantId: string) => {
    await apiClient.delete(`/products/${product.id}/variants/${variantId}`);
    setDeletingId(null);
    await refresh();
  };

  const f = (key: keyof VariantForm, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">واریانت‌ها (رنگ‌بندی)</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {product.name} — {product.sku} — {sizeLabel}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 space-y-3">
          <p className="text-xs font-semibold text-gray-500">
            {editId ? 'ویرایش رنگ' : 'تعریف رنگ جدید'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-end">
            {f('color', 'نام رنگ', 'text', 'سفید')}
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">کد رنگ</label>
              <input
                type="color"
                value={form.colorHex}
                onChange={(e) => setForm((p) => ({ ...p, colorHex: e.target.value }))}
                className="w-full h-[34px] rounded-lg border border-gray-200 cursor-pointer"
              />
            </div>
            {f('barcode', 'بارکد', 'text', 'اختیاری')}
          </div>

          <div>
            <p className="text-[10px] text-gray-400 mb-1.5">پالت رنگ‌های رایج</p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_COLORS.map((c) => (
                <button
                  key={c.hex + c.name}
                  type="button"
                  title={c.name}
                  onClick={() => pickColor(c.name, c.hex)}
                  className={cn(
                    'h-6 w-6 rounded-full border border-gray-200 hover:scale-110 transition-transform',
                    form.colorHex?.toLowerCase() === c.hex.toLowerCase() && 'ring-2 ring-primary ring-offset-1',
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {colorHistory.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 mb-1.5">تاریخچه رنگ‌ها</p>
              <div className="flex flex-wrap gap-1">
                {colorHistory.slice(0, 20).map((c) => (
                  <button
                    key={`${c.name}-${c.hex ?? ''}`}
                    type="button"
                    onClick={() => pickColor(c.name, c.hex || form.colorHex)}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-gray-200"
                      style={{ backgroundColor: c.hex || '#ccc' }}
                    />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            اینجا فقط رنگ و بارکد تعریف می‌شود؛ موجودی را از دکمه «موجودی» جداگانه ثبت کنید.
          </p>
          {saveError && <p className="text-xs text-error">{saveError}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.color}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'ذخیره...' : editId ? 'بروزرسانی رنگ' : 'افزودن رنگ'}
            </button>
            {editId && (
              <button onClick={cancelEdit} className="btn btn-outline btn-sm">
                انصراف
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {variants.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">
              رنگی تعریف نشده — از فرم بالا اضافه کنید
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {['رنگ', 'سایز', 'بارکد', ''].map((h) => (
                    <th key={h || 'actions'} className="px-4 py-2 text-right text-xs font-semibold text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {variants.map((v) => (
                  <tr
                    key={v.id}
                    className={cn('hover:bg-gray-50 transition-colors', editId === v.id && 'bg-primary-50')}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 rounded-full border border-gray-200 flex-shrink-0"
                          style={{ backgroundColor: v.colorHex }}
                        />
                        <span>{v.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{v.size || sizeLabel}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{v.barcode || '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEdit(v)} className="text-gray-400 hover:text-primary">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeletingId(v.id)} className="text-gray-400 hover:text-error">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center">
          <p className="text-xs text-gray-400">{variants.length} رنگ ثبت شده</p>
          <button onClick={onClose} className="btn btn-outline btn-sm">
            بستن
          </button>
        </div>

        {deletingId && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl">
            <div className="bg-white rounded-xl p-6 shadow-xl text-center">
              <p className="text-sm font-semibold text-gray-900 mb-4">حذف این رنگ؟</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingId(null)} className="btn btn-outline btn-sm">
                  انصراف
                </button>
                <button
                  onClick={() => handleDelete(deletingId)}
                  className="btn btn-sm bg-error text-white hover:bg-red-700"
                >
                  حذف
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StockModal({
  product,
  onClose,
  onDone,
}: {
  product: Product;
  onClose: () => void;
  onDone: () => void;
}) {
  const minOrder = Math.max(1, Number(product.minOrderQty) || 1);
  const current =
    typeof product.stock === 'number'
      ? product.stock
      : product.totalStock ??
        product.variants?.reduce((s, v) => s + v.stock, 0) ??
        0;
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const stock = Number(value);
    if (!Number.isFinite(stock) || stock < 0) {
      setError('عدد نامعتبر');
      return;
    }
    if (stock % minOrder !== 0) {
      setError(`موجودی باید مضربی از حداقل سفارش (${minOrder}) باشد`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await apiClient.post('/inventory/product/set', {
        productId: product.id,
        stock,
      });
      onDone();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در ذخیره موجودی');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">موجودی محصول</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {product.name} — {product.sku}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            موجودی مستقل از رنگ‌ها ثبت می‌شود و باید مضرب حداقل سفارش (
            <span className="font-bold text-gray-700">{minOrder}</span> عدد) باشد.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              تعداد موجودی
            </label>
            <input
              type="number"
              min={0}
              step={minOrder}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="btn btn-outline btn-sm">
              انصراف
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'ذخیره...' : 'ثبت موجودی'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminProducts() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [images, setImages] = useState<string[]>([]);
  const { upload: uploadImage, uploading: uploadingImg } = useImageUpload();
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; skuPrefix: string }>>([]);
  const [specMemory, setSpecMemory] = useState<SpecMemory>({});

  const { products, meta, loading, refetch } = useProducts({
    page,
    search: search || undefined,
    limit: 20,
    status: 'ALL',
  });

  useEffect(() => {
    apiClient
      .get<Array<{ id: string; name: string; skuPrefix: string }>>('/categories')
      .then((res) => setCategories(res ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    apiClient
      .get<SpecMemory>('/products/meta/spec-memory')
      .then((res) => setSpecMemory(res && typeof res === 'object' ? res : {}))
      .catch(() => undefined);
  }, []);

  const openCreate = () => {
    setForm({ ...emptyForm, specs: { ...emptySpecs, customFields: [] } });
    setImages([]);
    setEditProduct(null);
    setModal('create');
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setImages(p.images ?? []);
    const specs = p.specs ?? {};
    setForm({
      sku: p.sku,
      categoryId: p.categoryId ?? '',
      name: p.name,
      description: p.description ?? '',
      wholesalePrice: String(Math.round(Number(p.wholesalePrice) / 10)),
      retailPrice: p.retailPrice ? String(Math.round(Number(p.retailPrice) / 10)) : '',
      minOrderQty: String(p.minOrderQty),
      status: p.status,
      isDiscounted: !!p.isDiscounted,
      sizeType: (p.sizeType as FormData['sizeType']) || 'FREE',
      hasLength2: !!specs.length2,
      specs: {
        fabricType: specs.fabricType ?? '',
        packQty: specs.packQty ?? '',
        length: specs.length ?? '',
        length2: specs.length2 ?? '',
        chestWidth: specs.chestWidth ?? '',
        sleeveModel: specs.sleeveModel ?? '',
        buttonModel: specs.buttonModel ?? '',
        collarModel: specs.collarModel ?? '',
        customFields: (specs.customFields ?? []).map((cf) => ({
          label: cf.label ?? '',
          value: cf.value ?? '',
        })),
      },
    });
    setModal('edit');
  };

  const closeModal = () => {
    setModal(null);
    setEditProduct(null);
    setImages([]);
  };

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const url = await uploadImage(file);
        setImages((prev) => [...prev, url]);
      } catch {
        alert('آپلود عکس با خطا مواجه شد');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [uploadImage],
  );

  const setSpec = (key: keyof ProductSpecs, value: string) => {
    setForm((f) => ({ ...f, specs: { ...f.specs, [key]: value } }));
  };

  const addCustomField = () => {
    setForm((f) => ({
      ...f,
      specs: {
        ...f.specs,
        customFields: [...(f.specs.customFields ?? []), { label: '', value: '' }],
      },
    }));
  };

  const updateCustomField = (index: number, patch: Partial<ProductCustomField>) => {
    setForm((f) => {
      const list = [...(f.specs.customFields ?? [])];
      list[index] = { ...list[index], ...patch };
      return { ...f, specs: { ...f.specs, customFields: list } };
    });
  };

  const removeCustomField = (index: number) => {
    setForm((f) => ({
      ...f,
      specs: {
        ...f.specs,
        customFields: (f.specs.customFields ?? []).filter((_, i) => i !== index),
      },
    }));
  };

  const handleSave = useCallback(async () => {
    if (!form.name || !form.wholesalePrice) return;
    if (!form.sku && !form.categoryId && modal === 'create') return;
    setSaving(true);
    try {
      const customFields = (form.specs.customFields ?? [])
        .filter((cf) => cf.label.trim() || cf.value.trim())
        .map((cf) => ({ label: cf.label.trim(), value: cf.value.trim() }));

      const specs: ProductSpecs = {
        fabricType: form.specs.fabricType?.trim() || undefined,
        packQty: form.specs.packQty?.trim() || undefined,
        length: form.specs.length?.trim() || undefined,
        chestWidth: form.specs.chestWidth?.trim() || undefined,
        sleeveModel: form.specs.sleeveModel?.trim() || undefined,
        buttonModel: form.specs.buttonModel?.trim() || undefined,
        collarModel: form.specs.collarModel?.trim() || undefined,
        customFields: customFields.length ? customFields : undefined,
      };
      if (form.hasLength2 && form.specs.length2?.trim()) {
        specs.length2 = form.specs.length2.trim();
      }

      const payload = {
        sku: form.sku || undefined,
        categoryId: form.categoryId || undefined,
        name: form.name,
        description: form.description || undefined,
        specs,
        sizeType: form.sizeType,
        wholesalePrice: Number(form.wholesalePrice) * 10,
        retailPrice: form.retailPrice ? Number(form.retailPrice) * 10 : null,
        minOrderQty: Number(form.minOrderQty),
        status: form.status,
        isDiscounted: form.isDiscounted,
        images,
      };

      if (modal === 'create') await apiClient.post('/products', payload);
      else if (modal === 'edit' && editProduct) await apiClient.patch(`/products/${editProduct.id}`, payload);
      closeModal();
      refetch();
      apiClient
        .get<SpecMemory>('/products/meta/spec-memory')
        .then((res) => setSpecMemory(res && typeof res === 'object' ? res : {}))
        .catch(() => undefined);
    } finally {
      setSaving(false);
    }
  }, [form, modal, editProduct, refetch, images]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await apiClient.delete(`/products/${id}`);
        setDeleteId(null);
        refetch();
      } catch {
        /* ignore */
      }
    },
    [refetch],
  );

  const field = (key: 'sku' | 'name' | 'wholesalePrice' | 'retailPrice' | 'minOrderQty', label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );

  const specField = (
    key: keyof Omit<ProductSpecs, 'customFields'>,
    label: string,
    placeholder = '',
  ) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={(form.specs[key] as string) ?? ''}
        onChange={(e) => setSpec(key, e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <MemoryChips values={specMemory[key]} onPick={(v) => setSpec(key, v)} />
    </div>
  );

  const fabricLabel = (p: Product) => p.specs?.fabricType || p.fabric || '—';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">محصولات</h2>
          <p className="text-sm text-gray-500 mt-0.5">{meta.total} مدل در کاتالوگ</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary btn-md flex items-center gap-2">
          <Plus className="h-4 w-4" />
          افزودن محصول
        </button>
      </div>

      <div className="w-72">
        <Input
          placeholder="جستجو نام، SKU، پارچه..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          rightIcon={<Search className="h-4 w-4" />}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['SKU', 'نام محصول', 'جنس پارچه', 'واریانت‌ها', 'موجودی', 'قیمت عمده (ت)', 'وضعیت', ''].map(
                  (h) => (
                    <th
                      key={h || 'actions'}
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 rounded w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-gray-400 mb-3">محصولی یافت نشد</p>
                    <button onClick={openCreate} className="btn btn-primary btn-sm">
                      افزودن اولین محصول
                    </button>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const totalStock =
                    typeof p.stock === 'number'
                      ? p.stock
                      : p.totalStock ??
                        p.variants?.reduce((s, v) => s + v.stock, 0) ??
                        0;
                  const varCount = p.variants?.length ?? 0;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-gray-400">{p.sku}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                          {p.isNew && (
                            <Badge variant="primary" className="text-[10px] px-1.5 py-0">
                              جدید
                            </Badge>
                          )}
                          {p.isDiscounted && (
                            <Badge variant="gold" className="text-[10px] px-1.5 py-0">
                              تخفیف‌دار
                            </Badge>
                          )}
                          {p.isLimitedStock && (
                            <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                              موجودی محدود
                            </Badge>
                          )}
                          {p.status === 'COMING_SOON' && (
                            <Badge variant="info" className="text-[10px] px-1.5 py-0">
                              به زودی
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{fabricLabel(p)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setVariantProduct(p)}
                          className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          {varCount} رنگ
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setStockProduct(p)}
                          className={cn(
                            'flex items-center gap-1 text-sm font-bold hover:underline',
                            p.isLimitedStock
                              ? 'text-amber-600'
                              : totalStock === 0
                                ? 'text-error'
                                : 'text-gray-700',
                          )}
                          title="ثبت/ویرایش موجودی"
                        >
                          <Package className="h-3.5 w-3.5" />
                          {totalStock} عدد
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">
                        {(Number(p.wholesalePrice) / 10).toLocaleString('fa-IR')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            p.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-700'
                              : p.status === 'COMING_SOON'
                                ? 'bg-blue-100 text-blue-700'
                                : p.status === 'OUT_OF_STOCK'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-500',
                          )}
                        >
                          {STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(p)}
                            className="text-gray-400 hover:text-primary transition-colors"
                            title="ویرایش"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(p.id)}
                            className="text-gray-400 hover:text-error transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 border-t border-gray-100">
          <Pagination page={page} totalPages={meta.totalPages} onPageChange={setPage} />
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-gray-900">
                {modal === 'create' ? 'افزودن محصول جدید' : 'ویرایش محصول'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">دسته‌بندی</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">بدون دسته‌بندی</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.skuPrefix ? `(${c.skuPrefix})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">
                    اگر SKU خالی باشد، از روی این دسته‌بندی تولید می‌شود.
                  </p>
                </div>
                {field('sku', 'کد SKU (اختیاری)', 'text', 'LINEN-00001')}
              </div>

              {field('name', 'نام محصول', 'text', 'مانتو بهار')}

              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800">توضیحات محصول</p>
                <div className="grid grid-cols-2 gap-3">
                  {specField('fabricType', 'جنس پارچه', 'لینن')}
                  {specField('packQty', 'تعداد در پک', '۶')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {specField('length', 'قد کار', '۱۱۰')}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={form.hasLength2}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            hasLength2: e.target.checked,
                            specs: e.target.checked
                              ? f.specs
                              : { ...f.specs, length2: '' },
                          }))
                        }
                        className="rounded"
                      />
                      <span className="text-xs text-gray-700">محصول ست — قد ۲</span>
                    </label>
                    {form.hasLength2 && (
                      <>
                        <input
                          type="text"
                          value={form.specs.length2 ?? ''}
                          onChange={(e) => setSpec('length2', e.target.value)}
                          placeholder="قد ۲"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <MemoryChips
                          values={specMemory.length2}
                          onPick={(v) => setSpec('length2', v)}
                        />
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {specField('chestWidth', 'عرض سینه', '۵۰')}
                  {specField('sleeveModel', 'مدل آستین', 'کیمونو')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {specField('buttonModel', 'مدل دکمه', 'فلزی')}
                  {specField('collarModel', 'مدل یقه', 'شومیز')}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-600">فیلدهای سفارشی</p>
                    <button type="button" onClick={addCustomField} className="btn btn-outline btn-sm text-xs">
                      <Plus className="h-3 w-3" />
                      افزودن فیلد
                    </button>
                  </div>
                  {(form.specs.customFields ?? []).map((cf, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                      <div>
                        <input
                          type="text"
                          value={cf.label}
                          onChange={(e) => updateCustomField(i, { label: e.target.value })}
                          placeholder="عنوان"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <MemoryChips
                          values={specMemory.customLabel}
                          onPick={(v) => updateCustomField(i, { label: v })}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={cf.value}
                          onChange={(e) => updateCustomField(i, { value: e.target.value })}
                          placeholder="مقدار"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        {cf.label.trim() && (
                          <MemoryChips
                            values={specMemory[`custom:${cf.label.trim()}`]}
                            onPick={(v) => updateCustomField(i, { value: v })}
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomField(i)}
                        className="text-gray-400 hover:text-error mt-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">توضیحات SEO</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {field('wholesalePrice', 'قیمت عمده (تومان)', 'number', '125000')}
                {field('retailPrice', 'قیمت تکی (تومان)', 'number', '180000')}
                {field('minOrderQty', 'حداقل سفارش', 'number', '5')}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">وضعیت</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="ACTIVE">فعال</option>
                    <option value="ARCHIVED">بایگانی</option>
                    <option value="OUT_OF_STOCK">ناموجود</option>
                    <option value="COMING_SOON">به زودی</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">نوع سایز</label>
                  <select
                    value={form.sizeType}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        sizeType: e.target.value as FormData['sizeType'],
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="TWO">محصول ۲ سایزی</option>
                    <option value="THREE">محصول ۳ سایزی</option>
                    <option value="FREE">فری سایز</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDiscounted}
                  onChange={(e) => setForm((f) => ({ ...f, isDiscounted: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">محصول تخفیف‌دار</span>
              </label>

              <p className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                نشان «موجودی محدود» به‌صورت خودکار وقتی موجودی کل ≤ ۲× حداقل سفارش فعال می‌شود.
                نشان «جدید» به‌صورت خودکار برای یک هفته پس از ایجاد محصول نمایش داده می‌شود.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">تصاویر محصول</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {images.map((url, i) => (
                    <div key={url + i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImg}
                    className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-colors"
                  >
                    {uploadingImg ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    <span className="text-[10px] mt-1">{uploadingImg ? '' : 'آپلود'}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
                <p className="text-[11px] text-gray-400">حداکثر ۵ مگابایت — JPG، PNG، WebP</p>
              </div>

              {modal === 'create' && (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                  بعد از ذخیره، رنگ‌ها را از «واریانت‌ها» و موجودی را از دکمه موجودی (جدا از رنگ) ثبت کنید.
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={closeModal} className="btn btn-outline btn-md">
                انصراف
              </button>
              <button
                onClick={handleSave}
                disabled={
                  saving ||
                  !form.name ||
                  !form.wholesalePrice ||
                  (modal === 'create' && !form.sku && !form.categoryId)
                }
                className="btn btn-primary btn-md flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}

      {variantProduct && (
        <VariantsModal
          product={variantProduct}
          onClose={() => setVariantProduct(null)}
          onDone={refetch}
        />
      )}

      {stockProduct && (
        <StockModal
          product={stockProduct}
          onClose={() => setStockProduct(null)}
          onDone={refetch}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-6 w-6 text-error" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">حذف محصول</h3>
            <p className="text-sm text-gray-500 mb-6">آیا مطمئن هستید؟ این عملیات قابل بازگشت نیست.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 btn btn-outline btn-md">
                انصراف
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 btn btn-md bg-error text-white hover:bg-red-700"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

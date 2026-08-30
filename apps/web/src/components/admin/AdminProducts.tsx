'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Layers,
  ImagePlus,
  Loader2,
  Package,
} from 'lucide-react';
import { Input, Badge, Pagination } from '@/components/ui';
import { useProducts, Product, ProductSpecs, ProductCustomField } from '@/lib/hooks/useProducts';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  ColorVariantsEditor,
  ColorDraft,
  draftsFromVariants,
} from '@/components/admin/ColorVariantsEditor';
import {
  ProductDiscountSettings,
  validateChannelDiscount,
} from '@/components/admin/ProductDiscountSettings';
import {
  ProductRelatedPicker,
  type RelatedProductPick,
} from '@/components/admin/ProductRelatedPicker';
import { AdminExcelExportButtons } from '@/components/admin/AdminExcelExportButtons';

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

function sizeOptionsForType(sizeType?: string): string[] {
  const t = String(sizeType || 'FREE').toUpperCase();
  if (t === 'TWO') return ['سایز ۱', 'سایز ۲'];
  if (t === 'THREE') return ['سایز ۱', 'سایز ۲', 'سایز ۳'];
  return ['فری سایز'];
}

type SpecMemory = Record<string, string[]>;

const emptySpecs: ProductSpecs = {
  fabricType: '',
  designDetails: '',
  packageSpecs: '',
  manufacturingBadge: '',
  packQty: '',
  length: '',
  length2: '',
  length3: '',
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
  wholesaleSeoTitle: '',
  wholesaleSeoDescription: '',
  wholesaleFocusKeyword: '',
  wholesaleCanonical: '',
  retailSeoTitle: '',
  retailSeoDescription: '',
  retailFocusKeyword: '',
  retailCanonical: '',
  slug: '',
  wholesalePrice: '',
  retailPrice: '',
  minOrderQty: '1',
  status: 'ACTIVE',
  wholesaleIsDiscounted: false,
  wholesaleDiscountType: 'PERCENT' as 'PERCENT' | 'FIXED',
  wholesaleDiscountPercent: '',
  wholesaleDiscountAmount: '',
  wholesaleDiscountStartsAt: '',
  wholesaleDiscountEndsAt: '',
  retailIsDiscounted: false,
  retailDiscountType: 'PERCENT' as 'PERCENT' | 'FIXED',
  retailDiscountPercent: '',
  retailDiscountAmount: '',
  retailDiscountStartsAt: '',
  retailDiscountEndsAt: '',
  retailFullContent: '',
  wholesaleFullContent: '',
  legacyContent: '',
  sizeType: 'FREE' as 'TWO' | 'THREE' | 'FREE',
  specs: emptySpecs,
  hasLength2: false,
  hasLength3: false,
  collectionId: '',
  isPreOrder: false,
  preOrderDate: '',
  modelInfo: '',
  videoUrl: '',
  showOnWholesale: true,
  showOnRetail: true,
  guarantee: '',
  defaultRetailVariantId: '',
  allowWholesaleColorSelect: false,
  minWholesaleColors: '1',
};

const emptyVariantForm = {
  color: '',
  colorHex: '#000000',
  barcode: '',
  wholesaleStock: '0',
  retailStock: '0',
};

type FormData = typeof emptyForm;
type VariantForm = typeof emptyVariantForm;

function toDatetimeLocal(iso?: string | Date | null): string {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function relatedPicksFromProduct(p: Product): RelatedProductPick[] {
  const related = p.relatedProducts ?? [];
  if (related.length) {
    return related
      .map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        images: Array.isArray(item.images)
          ? item.images.filter((u): u is string => typeof u === 'string' && !!u)
          : [],
      }))
      .slice(0, 5);
  }
  return (p.relatedProductIds ?? [])
    .slice(0, 5)
    .map((id) => ({ id, name: id, sku: '', images: [] }));
}

function irrToTomanStr(irr: number | null | undefined): string {
  if (irr == null || !(Number(irr) > 0)) return '';
  return String(Math.round(Number(irr) / 10));
}

function asDiscountType(value: unknown): 'PERCENT' | 'FIXED' {
  return value === 'FIXED' ? 'FIXED' : 'PERCENT';
}

function channelDiscountOn(
  flag: boolean | null | undefined,
  compareAt: number | null | undefined,
  final: number | null | undefined
): boolean {
  if (flag != null) return !!flag;
  return Number(compareAt) > Number(final);
}

/** When the channel is discounted, show compare-at as BASE so the form does not drift. */
function loadChannelBaseToman(
  finalIrr: number | null | undefined,
  compareIrr: number | null | undefined,
  isDiscounted: boolean
): string {
  const final = Number(finalIrr) > 0 ? Math.round(Number(finalIrr) / 10) : 0;
  const compare = Number(compareIrr) > 0 ? Math.round(Number(compareIrr) / 10) : 0;
  if (isDiscounted && compare > final) return String(compare);
  return final > 0 ? String(final) : '';
}

function computedPackQtyFromDrafts(
  drafts: Array<{ color: string }>,
  sizeType: string
): number {
  const names = new Set(drafts.map((d) => d.color.trim()).filter(Boolean));
  return names.size * sizeOptionsForType(sizeType).length;
}

interface Variant {
  id: string;
  color: string;
  colorHex: string;
  size: string;
  stock: number;
  wholesaleStock?: number;
  retailStock?: number;
  barcode?: string;
}

interface ColorGroup {
  color: string;
  colorHex: string;
  barcode?: string;
  sizes: string[];
  wholesaleStock: number;
  retailStock: number;
  variantIds: string[];
}

function groupVariantsByColor(variants: Variant[]): ColorGroup[] {
  const map = new Map<string, ColorGroup>();
  for (const v of variants) {
    const key = v.color || '—';
    const existing = map.get(key);
    const w = Number(v.wholesaleStock) || 0;
    const r = Number(v.retailStock) || 0;
    if (!existing) {
      map.set(key, {
        color: v.color,
        colorHex: v.colorHex || '#ccc',
        barcode: v.barcode,
        sizes: v.size ? [v.size] : [],
        wholesaleStock: w,
        retailStock: r,
        variantIds: [v.id],
      });
    } else {
      if (v.size && !existing.sizes.includes(v.size)) existing.sizes.push(v.size);
      existing.wholesaleStock += w;
      existing.retailStock += r;
      existing.variantIds.push(v.id);
      if (!existing.barcode && v.barcode) existing.barcode = v.barcode;
      if (v.colorHex) existing.colorHex = v.colorHex;
    }
  }
  return Array.from(map.values());
}

interface SavedColor {
  id: string;
  name: string;
  hex?: string | null;
}

function MemoryChips({
  values,
  onPick,
  onDelete,
}: {
  values?: string[];
  onPick: (v: string) => void;
  onDelete?: (v: string) => void;
}) {
  if (!values?.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {values.slice(0, 12).map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 py-0.5 pl-1 pr-2 text-gray-600"
        >
          <button
            type="button"
            onClick={() => onPick(v)}
            className="hover:text-primary cursor-pointer text-[10px] transition-colors"
          >
            {v}
          </button>
          {onDelete && (
            <button
              type="button"
              title="حذف از حافظه"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(v);
              }}
              className="hover:text-error cursor-pointer p-0.5 text-gray-300"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
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
  const sizeOpts = sizeOptionsForType(product.sizeType);
  const [form, setForm] = useState<VariantForm>({ ...emptyVariantForm });
  const [editColor, setEditColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingColor, setDeletingColor] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>(product.variants ?? []);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedColors, setSavedColors] = useState<SavedColor[]>([]);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');
  const [colorBusy, setColorBusy] = useState(false);

  const sizeTypeLabel = SIZE_TYPE_LABELS[product.sizeType || 'FREE'] || SIZE_TYPE_LABELS.FREE;
  const colorGroups = groupVariantsByColor(variants);

  const loadSavedColors = useCallback(async () => {
    try {
      const res = await apiClient.get<SavedColor[]>('/products/meta/colors');
      setSavedColors(Array.isArray(res) ? res : []);
    } catch {
      setSavedColors([]);
    }
  }, []);

  useEffect(() => {
    loadSavedColors();
  }, [loadSavedColors]);

  const refresh = useCallback(async () => {
    const res = await apiClient.get<{ variants: Variant[] }>(`/products/${product.id}`);
    setVariants((res as { variants?: Variant[] }).variants ?? []);
    onDone();
  }, [product.id, onDone]);

  const totalWholesale = colorGroups.reduce((s, g) => s + g.wholesaleStock, 0);
  const totalRetail = colorGroups.reduce((s, g) => s + g.retailStock, 0);

  const startEdit = (g: ColorGroup) => {
    setEditColor(g.color);
    setSaveError(null);
    setForm({
      color: g.color,
      colorHex: g.colorHex || '#000000',
      barcode: g.barcode ?? '',
      wholesaleStock: String(g.wholesaleStock),
      retailStock: String(g.retailStock),
    });
  };

  const cancelEdit = () => {
    setEditColor(null);
    setSaveError(null);
    setForm({ ...emptyVariantForm });
  };

  const pickColor = (name: string, hex: string) => {
    setForm((p) => ({ ...p, color: name, colorHex: hex || p.colorHex }));
  };

  const addSavedColor = async () => {
    if (!newColorName.trim()) return;
    setColorBusy(true);
    try {
      await apiClient.post('/products/meta/colors', {
        name: newColorName.trim(),
        hex: newColorHex,
      });
      setNewColorName('');
      setNewColorHex('#000000');
      await loadSavedColors();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در ذخیره رنگ');
    } finally {
      setColorBusy(false);
    }
  };

  const removeSavedColor = async (id: string) => {
    if (!confirm('این رنگ از لیست سریع حذف شود؟')) return;
    setColorBusy(true);
    try {
      await apiClient.delete(`/products/meta/colors/${id}`);
      await loadSavedColors();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در حذف');
    } finally {
      setColorBusy(false);
    }
  };

  const handleSave = async () => {
    if (!form.color.trim()) return;
    const wholesaleStock = Math.max(0, Math.floor(Number(form.wholesaleStock) || 0));
    const retailStock = Math.max(0, Math.floor(Number(form.retailStock) || 0));
    if (!Number.isFinite(wholesaleStock) || !Number.isFinite(retailStock)) {
      setSaveError('موجودی نامعتبر است');
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const payload = {
        color: form.color.trim(),
        colorHex: form.colorHex,
        barcode: form.barcode || undefined,
        wholesaleStock,
        retailStock,
      };
      // Omit size → API creates all product sizes; stock once on first size (no duplicate totals)
      if (editColor) {
        await apiClient.put(`/products/${product.id}/variants/color-stock`, payload);
      } else {
        await apiClient.post(`/products/${product.id}/variants`, payload);
      }
      try {
        await apiClient.post('/products/meta/colors', {
          name: form.color.trim(),
          hex: form.colorHex,
        });
        await loadSavedColors();
      } catch {
        /* ignore */
      }
      setEditColor(null);
      setForm({ ...emptyVariantForm });
      await refresh();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'خطا در ذخیره رنگ');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteColor = async (color: string) => {
    await apiClient.delete(
      `/products/${product.id}/variants/by-color?color=${encodeURIComponent(color)}`
    );
    setDeletingColor(null);
    await refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">واریانت‌ها (رنگ / موجودی)</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              {product.name} — {product.sku} — {sizeTypeLabel}
            </p>
            <p className="text-primary mt-1 text-[11px]">
              موجودی هر رنگ یک‌بار ثبت می‌شود و روی همه سایزها ({sizeOpts.join('، ')}) اعمال می‌گردد
              — بدون تکرار در آمار
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[48vh] space-y-3 overflow-y-auto border-b border-gray-100 bg-gray-50 px-6 py-4">
          <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs font-semibold text-gray-600">
              لیست رنگ‌های ذخیره‌شده (انتخاب سریع)
            </p>
            <div className="flex min-h-[28px] flex-wrap gap-1.5">
              {savedColors.length === 0 ? (
                <p className="text-[11px] text-gray-400">
                  هنوز رنگی ذخیره نشده — از فرم زیر اضافه کنید
                </p>
              ) : (
                savedColors.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 py-0.5 pl-1 pr-2"
                  >
                    <button
                      type="button"
                      title={`انتخاب ${c.name}`}
                      onClick={() => pickColor(c.name, c.hex || '#000000')}
                      className="hover:text-primary flex cursor-pointer items-center gap-1.5 text-[11px] text-gray-700"
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-gray-300"
                        style={{ backgroundColor: c.hex || '#ccc' }}
                      />
                      {c.name}
                    </button>
                    <button
                      type="button"
                      title="حذف از لیست"
                      disabled={colorBusy}
                      onClick={() => removeSavedColor(c.id)}
                      className="hover:text-error cursor-pointer p-0.5 text-gray-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[120px] flex-1">
                <label className="mb-1 block text-[10px] font-medium text-gray-500">
                  نام رنگ جدید
                </label>
                <input
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  placeholder="مثلاً نسکافه‌ای"
                  className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-gray-500">کد</label>
                <input
                  type="color"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="h-[34px] w-14 cursor-pointer rounded-lg border border-gray-200"
                />
              </div>
              <button
                type="button"
                disabled={colorBusy || !newColorName.trim()}
                onClick={addSavedColor}
                className="btn btn-outline btn-sm cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                افزودن به لیست
              </button>
            </div>
            <div>
              <p className="mb-1 text-[10px] text-gray-400">پالت پیشنهادی</p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_COLORS.map((c) => (
                  <button
                    key={c.hex + c.name}
                    type="button"
                    title={c.name}
                    onClick={() => {
                      setNewColorName(c.name);
                      setNewColorHex(c.hex);
                      pickColor(c.name, c.hex);
                    }}
                    className={cn(
                      'h-6 w-6 cursor-pointer rounded-full border border-gray-200 transition-transform hover:scale-110',
                      form.colorHex?.toLowerCase() === c.hex.toLowerCase() &&
                        'ring-primary ring-2 ring-offset-1'
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-500">
            {editColor ? `ویرایش موجودی رنگ «${editColor}»` : 'افزودن رنگ + موجودی (همه سایزها)'}
          </p>
          <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500">نام رنگ</label>
              <input
                value={form.color}
                onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                placeholder="سفید"
                disabled={!!editColor}
                className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500">کد رنگ</label>
              <input
                type="color"
                value={form.colorHex}
                onChange={(e) => setForm((p) => ({ ...p, colorHex: e.target.value }))}
                className="h-[34px] w-full cursor-pointer rounded-lg border border-gray-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500">سایزها</label>
              <div className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-600">
                {sizeOpts.join(' · ')}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500">
                موجودی عمده
              </label>
              <input
                type="number"
                min={0}
                value={form.wholesaleStock}
                onChange={(e) => setForm((p) => ({ ...p, wholesaleStock: e.target.value }))}
                className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500">موجودی تکی</label>
              <input
                type="number"
                min={0}
                value={form.retailStock}
                onChange={(e) => setForm((p) => ({ ...p, retailStock: e.target.value }))}
                className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500">بارکد</label>
              <input
                value={form.barcode}
                onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))}
                placeholder="اختیاری"
                className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1"
              />
            </div>
          </div>

          <div className="border-primary/20 bg-primary-50/50 flex flex-wrap gap-4 rounded-lg border px-3 py-2 text-sm">
            <span>
              جمع عمده:{' '}
              <strong className="text-primary text-base font-extrabold tabular-nums">
                {totalWholesale}
              </strong>
            </span>
            <span>
              جمع تکی:{' '}
              <strong className="text-base font-extrabold tabular-nums text-amber-700">
                {totalRetail}
              </strong>
            </span>
            <span className="self-center text-[11px] text-gray-500">
              ({colorGroups.length} رنگ — موجودی هر رنگ یک‌بار در جمع حساب می‌شود)
            </span>
          </div>
          {saveError && <p className="text-error text-xs">{saveError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.color.trim()}
              className="btn btn-primary btn-sm flex cursor-pointer items-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'ذخیره...' : editColor ? 'بروزرسانی موجودی رنگ' : 'افزودن رنگ'}
            </button>
            {editColor && (
              <button
                type="button"
                onClick={cancelEdit}
                className="btn btn-outline btn-sm cursor-pointer"
              >
                انصراف
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {colorGroups.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              رنگی تعریف نشده — از فرم بالا اضافه کنید
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  {['رنگ', 'سایزها', 'موجودی عمده', 'موجودی تکی', 'بارکد', ''].map((h) => (
                    <th
                      key={h || 'actions'}
                      className="px-3 py-2 text-right text-xs font-semibold text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {colorGroups.map((g) => (
                  <tr
                    key={g.color}
                    className={cn(
                      'transition-colors hover:bg-gray-50',
                      editColor === g.color && 'bg-primary-50'
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 flex-shrink-0 rounded-full border border-gray-200"
                          style={{ backgroundColor: g.colorHex }}
                        />
                        <span>{g.color}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">
                      {g.sizes.join(' · ') || '—'}
                    </td>
                    <td className="text-primary px-3 py-2.5 font-mono text-sm font-semibold">
                      {g.wholesaleStock}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-sm font-semibold text-amber-700">
                      {g.retailStock}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-400">
                      {g.barcode || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(g)}
                          className="hover:text-primary cursor-pointer text-gray-400"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingColor(g.color)}
                          className="hover:text-error cursor-pointer text-gray-400"
                        >
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-6 py-3">
          <p className="text-sm font-semibold text-gray-800">
            {colorGroups.length} رنگ · جمع عمده{' '}
            <span className="text-primary tabular-nums">{totalWholesale}</span>
            {' · '}
            جمع تکی <span className="tabular-nums text-amber-700">{totalRetail}</span>
          </p>
          <button type="button" onClick={onClose} className="btn btn-outline btn-sm cursor-pointer">
            بستن
          </button>
        </div>

        {deletingColor && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/30">
            <div className="rounded-xl bg-white p-6 text-center shadow-xl">
              <p className="mb-4 text-sm font-semibold text-gray-900">
                حذف رنگ «{deletingColor}» و همه سایزهایش؟
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingColor(null)}
                  className="btn btn-outline btn-sm cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteColor(deletingColor)}
                  className="btn btn-sm bg-error cursor-pointer text-white hover:bg-red-700"
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

export function AdminProducts() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [images, setImages] = useState<string[]>([]);
  const [colorDrafts, setColorDrafts] = useState<ColorDraft[]>([]);
  const [initialColorNames, setInitialColorNames] = useState<string[]>([]);
  const { upload: uploadImage, uploading: uploadingImg } = useImageUpload();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [relatedPicks, setRelatedPicks] = useState<RelatedProductPick[]>([]);
  const [contentBusy, setContentBusy] = useState<'RETAIL' | 'WHOLESALE' | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string; skuPrefix: string }>
  >([]);
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([]);
  const [specMemory, setSpecMemory] = useState<SpecMemory>({});
  const [badgeSettings, setBadgeSettings] = useState({
    limitedStockMultiplier: 2,
    newBadgeDays: 7,
  });
  const [publicationBadges, setPublicationBadges] = useState<Record<string, string[]>>({});

  const refreshSpecMemory = useCallback(() => {
    apiClient
      .get<SpecMemory>('/products/meta/spec-memory')
      .then((res) => setSpecMemory(res && typeof res === 'object' ? res : {}))
      .catch(() => undefined);
  }, []);

  const deleteSpecMemoryValue = useCallback(
    async (fieldKey: string, value: string) => {
      try {
        await apiClient.delete(
          `/products/meta/spec-memory?fieldKey=${encodeURIComponent(fieldKey)}&value=${encodeURIComponent(value)}`
        );
        refreshSpecMemory();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : 'خطا در حذف');
      }
    },
    [refreshSpecMemory]
  );

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
    apiClient
      .get<Array<{ id: string; name: string }>>('/collections')
      .then((res) => setCollections(Array.isArray(res) ? res : []))
      .catch(() => undefined);
    apiClient
      .get<Array<{ sourceId: string; sourceType: string; channel: string; status: string }>>('/omnichannel/publications')
      .then((rows) => {
        const map: Record<string, string[]> = {};
        for (const row of rows ?? []) {
          if (row.sourceType !== 'PRODUCT') continue;
          (map[row.sourceId] ||= []).push(`${row.channel}:${row.status}`);
        }
        setPublicationBadges(map);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshSpecMemory();
  }, [refreshSpecMemory]);

  useEffect(() => {
    apiClient
      .get<{ business?: { limitedStockMultiplier?: number; newBadgeDays?: number } }>(
        '/settings/admin'
      )
      .then((s) => {
        setBadgeSettings({
          limitedStockMultiplier: Math.max(1, Number(s?.business?.limitedStockMultiplier) || 2),
          newBadgeDays: Math.max(1, Number(s?.business?.newBadgeDays) || 7),
        });
      })
      .catch(() => undefined);
  }, []);

  const openCreate = () => {
    setForm({ ...emptyForm, specs: { ...emptySpecs, customFields: [] } });
    setImages([]);
    setColorDrafts([]);
    setInitialColorNames([]);
    setRelatedPicks([]);
    setSaveError(null);
    setSlugError(null);
    setEditProduct(null);
    setModal('create');
  };

  const openEdit = async (p: Product) => {
    let src = p;
    try {
      src = await apiClient.get<Product>(`/products/${p.id}`);
    } catch {
      src = p;
    }
    setEditProduct(src);
    const sizeLabels = sizeOptionsForType(src.sizeType);
    const drafts = draftsFromVariants(src.variants ?? [], sizeLabels);
    setColorDrafts(drafts);
    setInitialColorNames(drafts.map((d) => d.originalColor || d.color).filter(Boolean));
    const colorImgs = drafts.map((d) => d.imageUrl).filter(Boolean);
    const mergedImages = [...new Set([...(src.images ?? []), ...colorImgs])];
    setImages(mergedImages);
    setRelatedPicks(relatedPicksFromProduct(src));
    setSaveError(null);
    setSlugError(null);
    const specs = src.specs ?? {};
    const seo = (src.seoMeta ?? {}) as Record<string, string | undefined>;
    const wholesaleOn = channelDiscountOn(
      src.wholesaleIsDiscounted,
      src.wholesaleCompareAtPrice,
      src.wholesalePrice
    );
    const retailOn = channelDiscountOn(
      src.retailIsDiscounted,
      src.retailCompareAtPrice,
      src.retailPrice
    );
    setForm({
      sku: src.sku,
      categoryId: src.categoryId ?? '',
      name: src.name,
      slug: src.slug ?? '',
      description: src.description ?? '',
      retailFullContent: src.retailFullContent ?? src.description ?? '',
      wholesaleFullContent: src.wholesaleFullContent ?? src.description ?? '',
      legacyContent: src.legacyContent ?? '',
      wholesaleIsDiscounted: wholesaleOn,
      wholesaleDiscountType: asDiscountType(src.wholesaleDiscountType ?? src.discountType),
      wholesaleDiscountPercent:
        src.wholesaleDiscountPercent != null
          ? String(src.wholesaleDiscountPercent)
          : src.discountPercent != null
            ? String(src.discountPercent)
            : '',
      wholesaleDiscountAmount: irrToTomanStr(src.wholesaleDiscountAmount ?? src.discountAmount),
      wholesaleDiscountStartsAt: toDatetimeLocal(
        src.wholesaleDiscountStartsAt ?? src.discountStartsAt
      ),
      wholesaleDiscountEndsAt: toDatetimeLocal(src.wholesaleDiscountEndsAt ?? src.discountEndsAt),
      retailIsDiscounted: retailOn,
      retailDiscountType: asDiscountType(src.retailDiscountType ?? src.discountType),
      retailDiscountPercent:
        src.retailDiscountPercent != null
          ? String(src.retailDiscountPercent)
          : src.discountPercent != null
            ? String(src.discountPercent)
            : '',
      retailDiscountAmount: irrToTomanStr(src.retailDiscountAmount ?? src.discountAmount),
      retailDiscountStartsAt: toDatetimeLocal(src.retailDiscountStartsAt ?? src.discountStartsAt),
      retailDiscountEndsAt: toDatetimeLocal(src.retailDiscountEndsAt ?? src.discountEndsAt),
      wholesaleSeoTitle: seo.wholesaleTitle || seo.title || '',
      wholesaleSeoDescription: seo.wholesaleDescription || seo.description || '',
      wholesaleFocusKeyword: seo.wholesaleFocusKeyword || seo.focusKeyword || '',
      wholesaleCanonical: seo.wholesaleCanonical || seo.canonical || '',
      retailSeoTitle: seo.retailTitle || '',
      retailSeoDescription: seo.retailDescription || '',
      retailFocusKeyword: seo.retailFocusKeyword || '',
      retailCanonical: seo.retailCanonical || '',
      wholesalePrice: loadChannelBaseToman(
        src.wholesalePrice,
        src.wholesaleCompareAtPrice,
        wholesaleOn
      ),
      retailPrice: src.retailPrice
        ? loadChannelBaseToman(src.retailPrice, src.retailCompareAtPrice, retailOn)
        : '',
      minOrderQty: String(src.minOrderQty ?? 1),
      status: src.status,
      sizeType: (src.sizeType as FormData['sizeType']) || 'FREE',
      hasLength2: !!specs.length2,
      hasLength3: !!specs.length3,
      collectionId: src.collectionId ?? '',
      isPreOrder: !!src.isPreOrder,
      preOrderDate: src.preOrderDate ? String(src.preOrderDate).slice(0, 10) : '',
      modelInfo: src.modelInfo ?? '',
      videoUrl: src.videoUrl ?? '',
      showOnWholesale: src.showOnWholesale !== false,
      showOnRetail: src.showOnRetail !== false,
      guarantee: (src as { guarantee?: string | null }).guarantee ?? '',
      defaultRetailVariantId: (src as { defaultRetailVariantId?: string | null }).defaultRetailVariantId ?? '',
      allowWholesaleColorSelect: !!src.allowWholesaleColorSelect,
      minWholesaleColors: String(Math.max(1, Number(src.minWholesaleColors) || 1)),
      specs: {
        fabricType: specs.fabricType ?? '',
        designDetails: specs.designDetails ?? '',
        packageSpecs: specs.packageSpecs ?? '',
        manufacturingBadge: specs.manufacturingBadge ?? '',
        packQty: specs.packQty ?? '',
        length: specs.length ?? '',
        length2: specs.length2 ?? '',
        length3: specs.length3 ?? '',
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
    setColorDrafts([]);
    setInitialColorNames([]);
    setRelatedPicks([]);
    setSaveError(null);
    setSlugError(null);
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
    [uploadImage]
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
    setSaveError(null);
    setSlugError(null);

    const minQty = Number(form.minOrderQty);
    if (!Number.isFinite(minQty) || minQty < 1) {
      setSaveError('حداقل سفارش باید حداقل ۱ پک باشد');
      return;
    }

    const wholesaleBaseToman = Number(form.wholesalePrice) || 0;
    const retailBaseToman = Number(form.retailPrice) || 0;
    const wholesaleDiscountError = validateChannelDiscount({
      enabled: form.wholesaleIsDiscounted,
      type: form.wholesaleDiscountType,
      percent: form.wholesaleDiscountPercent,
      amountToman: form.wholesaleDiscountAmount,
      baseToman: wholesaleBaseToman,
      label: 'عمده',
    });
    if (wholesaleDiscountError) {
      setSaveError(wholesaleDiscountError);
      return;
    }
    const retailDiscountError = validateChannelDiscount({
      enabled: form.retailIsDiscounted,
      type: form.retailDiscountType,
      percent: form.retailDiscountPercent,
      amountToman: form.retailDiscountAmount,
      baseToman: retailBaseToman,
      label: 'تکی',
    });
    if (retailDiscountError) {
      setSaveError(retailDiscountError);
      return;
    }

    setSaving(true);
    try {
      const customFields = (form.specs.customFields ?? [])
        .filter((cf) => cf.label.trim() || cf.value.trim())
        .map((cf) => ({ label: cf.label.trim(), value: cf.value.trim() }));

      const sizeLabels = sizeOptionsForType(form.sizeType);
      const computedPackQty = computedPackQtyFromDrafts(colorDrafts, form.sizeType);

      const specs: ProductSpecs = {
        fabricType: form.specs.fabricType?.trim() || undefined,
        designDetails: form.specs.designDetails?.trim() || undefined,
        packageSpecs: form.specs.packageSpecs?.trim() || undefined,
        manufacturingBadge: form.specs.manufacturingBadge?.trim() || undefined,
        packQty: String(computedPackQty),
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
      if (form.hasLength3 && form.specs.length3?.trim()) {
        specs.length3 = form.specs.length3.trim();
      }

      const seoMeta = {
        // wholesale (also mirrored to legacy keys for older readers)
        wholesaleTitle: form.wholesaleSeoTitle.trim() || undefined,
        wholesaleDescription: form.wholesaleSeoDescription.trim() || undefined,
        wholesaleFocusKeyword: form.wholesaleFocusKeyword.trim() || undefined,
        wholesaleCanonical: form.wholesaleCanonical.trim() || undefined,
        title: form.wholesaleSeoTitle.trim() || undefined,
        description: form.wholesaleSeoDescription.trim() || undefined,
        focusKeyword: form.wholesaleFocusKeyword.trim() || undefined,
        canonical: form.wholesaleCanonical.trim() || undefined,
        // retail
        retailTitle: form.retailSeoTitle.trim() || undefined,
        retailDescription: form.retailSeoDescription.trim() || undefined,
        retailFocusKeyword: form.retailFocusKeyword.trim() || undefined,
        retailCanonical: form.retailCanonical.trim() || undefined,
      };

      const colorImageUrls = colorDrafts.map((d) => d.imageUrl).filter(Boolean);
      const galleryImages = [...new Set([...images, ...colorImageUrls])];

      const wholesaleIsDiscounted = !!form.wholesaleIsDiscounted;
      const retailIsDiscounted = !!form.retailIsDiscounted;

      const payload = {
        sku: form.sku || undefined,
        categoryId: form.categoryId || undefined,
        name: form.name,
        slug: form.slug.trim() || undefined,
        description: form.description || form.wholesaleFullContent || undefined,
        retailFullContent: form.retailFullContent.trim() || null,
        wholesaleFullContent: form.wholesaleFullContent.trim() || null,
        relatedProductIds: relatedPicks.map((item) => item.id).slice(0, 5),
        wholesaleIsDiscounted,
        retailIsDiscounted,
        wholesaleDiscountType: form.wholesaleDiscountType,
        wholesaleDiscountPercent:
          form.wholesaleDiscountType === 'PERCENT' && form.wholesaleDiscountPercent
            ? Number(form.wholesaleDiscountPercent)
            : null,
        wholesaleDiscountAmount:
          form.wholesaleDiscountType === 'FIXED' && form.wholesaleDiscountAmount
            ? Number(form.wholesaleDiscountAmount) * 10
            : null,
        wholesaleDiscountStartsAt: form.wholesaleDiscountStartsAt
          ? new Date(form.wholesaleDiscountStartsAt).toISOString()
          : null,
        wholesaleDiscountEndsAt: form.wholesaleDiscountEndsAt
          ? new Date(form.wholesaleDiscountEndsAt).toISOString()
          : null,
        retailDiscountType: form.retailDiscountType,
        retailDiscountPercent:
          form.retailDiscountType === 'PERCENT' && form.retailDiscountPercent
            ? Number(form.retailDiscountPercent)
            : null,
        retailDiscountAmount:
          form.retailDiscountType === 'FIXED' && form.retailDiscountAmount
            ? Number(form.retailDiscountAmount) * 10
            : null,
        retailDiscountStartsAt: form.retailDiscountStartsAt
          ? new Date(form.retailDiscountStartsAt).toISOString()
          : null,
        retailDiscountEndsAt: form.retailDiscountEndsAt
          ? new Date(form.retailDiscountEndsAt).toISOString()
          : null,
        seoMeta,
        specs,
        sizeType: form.sizeType,
        wholesalePrice: wholesaleBaseToman * 10,
        retailPrice: form.retailPrice ? retailBaseToman * 10 : null,
        minOrderQty: Number(form.minOrderQty),
        status: form.status,
        isDiscounted: wholesaleIsDiscounted || retailIsDiscounted,
        images: galleryImages,
        collectionId: form.collectionId || null,
        isPreOrder: form.isPreOrder,
        preOrderDate: form.isPreOrder && form.preOrderDate ? form.preOrderDate : null,
        modelInfo: form.modelInfo.trim() || null,
        videoUrl: form.videoUrl.trim() || null,
        showOnWholesale: form.showOnWholesale,
        showOnRetail: form.showOnRetail,
        guarantee: form.guarantee.trim() || null,
        defaultRetailVariantId: form.defaultRetailVariantId || null,
        allowWholesaleColorSelect: !!form.allowWholesaleColorSelect,
        minWholesaleColors: Math.max(1, Number(form.minWholesaleColors) || 1),
      };

      let productId = editProduct?.id;
      if (modal === 'create') {
        const created = await apiClient.post<{ id: string }>('/products', payload);
        productId = created.id;
      } else if (modal === 'edit' && editProduct) {
        await apiClient.patch(`/products/${editProduct.id}`, payload);
        productId = editProduct.id;
      }

      if (productId) {
        for (const d of colorDrafts) {
          const body = {
            color: d.color.trim(),
            colorHex: d.colorHex,
            barcode: d.barcode || undefined,
            imageUrl: d.imageUrl || null,
            sizes: sizeLabels.map((size) => ({
              size,
              wholesaleStock: Math.max(0, Math.floor(Number(d.sizeStocks[size]?.wholesale) || 0)),
              retailStock: Math.max(0, Math.floor(Number(d.sizeStocks[size]?.retail) || 0)),
              stock: Math.max(0, Math.floor(Number(d.sizeStocks[size]?.wholesale) || 0)),
            })),
          };
          const wasExisting = !!d.originalColor && initialColorNames.includes(d.originalColor);
          if (wasExisting && d.originalColor !== d.color.trim()) {
            await apiClient.delete(
              `/products/${productId}/variants/by-color?color=${encodeURIComponent(d.originalColor!)}`
            );
          }
          await apiClient.put(`/products/${productId}/variants/color-stock`, body);
        }
        const keepNames = new Set(colorDrafts.map((d) => d.color.trim()));
        for (const oldName of initialColorNames) {
          if (oldName && !keepNames.has(oldName)) {
            await apiClient.delete(
              `/products/${productId}/variants/by-color?color=${encodeURIComponent(oldName)}`
            );
          }
        }
      }

      closeModal();
      refetch();
      refreshSpecMemory();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'خطا در ذخیره محصول';
      setSaveError(msg);
      if (/slug|مسیر رزرو/i.test(msg)) {
        setSlugError(msg);
      } else {
        alert(msg);
      }
    } finally {
      setSaving(false);
    }
  }, [
    form,
    modal,
    editProduct,
    refetch,
    images,
    colorDrafts,
    initialColorNames,
    relatedPicks,
    refreshSpecMemory,
  ]);

  const generateContent = useCallback(
    async (channel: 'RETAIL' | 'WHOLESALE') => {
      setContentBusy(channel);
      try {
        const res = await apiClient.post<{ text: string }>('/products/content-preview', {
          channel,
          productId: editProduct?.id,
          name: form.name,
          specs: form.specs,
          sizeType: form.sizeType,
          colors: colorDrafts.map((d) => d.color.trim()).filter(Boolean),
          minOrderQty: Number(form.minOrderQty) || 1,
          description: form.description,
          careInstructions: editProduct?.careInstructions ?? null,
        });
        const text = typeof res?.text === 'string' ? res.text : '';
        if (channel === 'RETAIL') {
          setForm((f) => ({ ...f, retailFullContent: text }));
        } else {
          setForm((f) => ({ ...f, wholesaleFullContent: text }));
        }
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : 'خطا در ساخت متن');
      } finally {
        setContentBusy(null);
      }
    },
    [editProduct, form.name, form.specs, form.sizeType, form.minOrderQty, form.description, colorDrafts]
  );

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
    [refetch]
  );

  const field = (
    key: 'sku' | 'name' | 'wholesalePrice' | 'retailPrice',
    label: string,
    type = 'text',
    placeholder = ''
  ) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
      />
    </div>
  );

  const specField = (
    key: keyof Omit<ProductSpecs, 'customFields'>,
    label: string,
    placeholder = ''
  ) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type="text"
        value={(form.specs[key] as string) ?? ''}
        onChange={(e) => setSpec(key, e.target.value)}
        placeholder={placeholder}
        className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
      />
      <MemoryChips
        values={specMemory[key]}
        onPick={(v) => setSpec(key, v)}
        onDelete={(v) => deleteSpecMemoryValue(key, v)}
      />
    </div>
  );

  const fabricLabel = (p: Product) => p.specs?.fabricType || p.fabric || '—';
  const computedPackQty = computedPackQtyFromDrafts(colorDrafts, form.sizeType);
  const minPackQty = Math.max(1, Math.floor(Number(form.minOrderQty) || 1));
  const packSummary = `حداقل ${minPackQty.toLocaleString('fa-IR')} پک — هر پک ${computedPackQty.toLocaleString('fa-IR')} عدد — مجموع حداقل سفارش ${(minPackQty * computedPackQty).toLocaleString('fa-IR')} عدد`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">محصولات</h2>
          <p className="mt-0.5 text-sm text-gray-500">{meta.total} مدل در کاتالوگ</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <AdminExcelExportButtons kind="products" />
          <button onClick={openCreate} className="btn btn-primary btn-md flex items-center gap-2">
            <Plus className="h-4 w-4" />
            افزودن محصول
          </button>
        </div>
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
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  'SKU',
                  'نام محصول',
                  'جنس پارچه',
                  'واریانت‌ها',
                  'موجودی',
                  'قیمت عمده (ت)',
                  'وضعیت',
                  '',
                ].map((h) => (
                  <th
                    key={h || 'actions'}
                    className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 w-20 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="mb-3 text-gray-400">محصولی یافت نشد</p>
                    <button onClick={openCreate} className="btn btn-primary btn-sm">
                      افزودن اولین محصول
                    </button>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const wholesaleSum =
                    p.variants?.reduce(
                      (s, v) => s + (Number((v as { wholesaleStock?: number }).wholesaleStock) || 0),
                      0
                    ) ?? 0;
                  const totalStock =
                    typeof p.wholesaleStock === 'number' ? p.wholesaleStock : wholesaleSum;
                  const pubs = publicationBadges[p.id] || [];
                  const varCount = new Set((p.variants ?? []).map((v) => v.color).filter(Boolean))
                    .size;
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.sku}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                          {p.isNew && (
                            <Badge variant="primary" className="px-1.5 py-0 text-[10px]">
                              جدید
                            </Badge>
                          )}
                          {p.isDiscounted && (
                            <Badge variant="gold" className="px-1.5 py-0 text-[10px]">
                              تخفیف‌دار
                            </Badge>
                          )}
                          {p.isLimitedStock && (
                            <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                              موجودی محدود
                            </Badge>
                          )}
                          {p.status === 'COMING_SOON' && (
                            <Badge variant="info" className="px-1.5 py-0 text-[10px]">
                              به زودی
                            </Badge>
                          )}
                          {pubs.map((label) => (
                            <Badge key={label} variant="info" className="px-1.5 py-0 text-[10px]">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{fabricLabel(p)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-primary flex items-center gap-1 text-xs font-medium hover:underline"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          {varCount} رنگ
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-sm font-bold tabular-nums',
                            p.isLimitedStock
                              ? 'text-amber-600'
                              : totalStock === 0
                                ? 'text-error'
                                : 'text-gray-700'
                          )}
                          title="جمع موجودی عمده از واریانت‌ها (فقط خواندنی)"
                        >
                          <Package className="h-3.5 w-3.5" />
                          {totalStock} عدد
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-gray-900">
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
                                  : 'bg-gray-100 text-gray-500'
                          )}
                        >
                          {STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(p)}
                            className="hover:text-primary text-gray-400 transition-colors"
                            title="ویرایش"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(p.id)}
                            className="hover:text-error text-gray-400 transition-colors"
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
        <div className="border-t border-gray-100 px-4">
          <Pagination page={page} totalPages={meta.totalPages} onPageChange={setPage} />
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50">
          <div className="flex h-full max-h-[100dvh] w-full flex-col bg-white shadow-2xl">
            <div className="z-10 flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">
                {modal === 'create' ? 'افزودن محصول جدید' : 'ویرایش محصول'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 overflow-y-auto p-6">
              {saveError ? (
                <p className="text-error rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm">
                  {saveError}
                </p>
              ) : null}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">دسته‌بندی</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                    className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  >
                    <option value="">بدون دسته‌بندی</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.skuPrefix ? `(${c.skuPrefix})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-gray-400">
                    اگر SKU خالی باشد، از روی این دسته‌بندی تولید می‌شود.
                  </p>
                </div>
                {field('sku', 'کد SKU (اختیاری)', 'text', 'LINEN-00001')}
              </div>

              {field('name', 'نام محصول', 'text', 'مانتو بهار')}

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  اسلاگ آدرس (slug)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugError(null);
                    setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }));
                  }}
                  placeholder="manto-bahar"
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2',
                    slugError
                      ? 'border-red-400 focus:ring-red-200'
                      : 'focus:ring-primary/30 border-gray-200'
                  )}
                />
                {slugError ? (
                  <p className="text-error mt-1 text-xs">{slugError}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-gray-400">
                    حروف کوچک انگلیسی، یکتا. اگر خالی بماند از SKU ساخته می‌شود.
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                <p className="text-sm font-semibold text-gray-800">توضیحات محصول</p>
                <div className="grid grid-cols-2 gap-3">
                  {specField('fabricType', 'جنس پارچه', 'لینن')}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      تعداد در هر پک
                    </label>
                    <p className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm text-gray-700">
                      {computedPackQty.toLocaleString('fa-IR')} عدد (رنگ‌های متمایز × سایز)
                    </p>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    جزئیات طراحی
                  </label>
                  <textarea
                    value={form.specs.designDetails ?? ''}
                    onChange={(e) => setSpec('designDetails', e.target.value)}
                    rows={2}
                    placeholder="یقه، دکمه، برش، جزئیات دوخت…"
                    className="focus:ring-primary/30 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {specField('packageSpecs', 'مشخصات پکیج', 'مانتو + شلوار')}
                  {specField('manufacturingBadge', 'نشان ویژه تولید', 'شستشوی آنزیمی ضدآبرفت')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {specField('length', 'قد ۱ (سانتی‌متر)', '۱۱۰')}
                  <div>
                    <label className="mb-2 flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.hasLength2}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            hasLength2: e.target.checked,
                            specs: e.target.checked ? f.specs : { ...f.specs, length2: '' },
                          }))
                        }
                        className="rounded"
                      />
                      <span className="text-xs text-gray-700">قد ۲</span>
                    </label>
                    {form.hasLength2 && (
                      <>
                        <input
                          type="text"
                          value={form.specs.length2 ?? ''}
                          onChange={(e) => setSpec('length2', e.target.value)}
                          placeholder="قد ۲"
                          className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                        />
                        <MemoryChips
                          values={specMemory.length2}
                          onPick={(v) => setSpec('length2', v)}
                          onDelete={(v) => deleteSpecMemoryValue('length2', v)}
                        />
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-2 flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.hasLength3}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          hasLength3: e.target.checked,
                          specs: e.target.checked ? f.specs : { ...f.specs, length3: '' },
                        }))
                      }
                      className="rounded"
                    />
                    <span className="text-xs text-gray-700">قد ۳ (ست سه‌تکه)</span>
                  </label>
                  {form.hasLength3 && (
                    <input
                      type="text"
                      value={form.specs.length3 ?? ''}
                      onChange={(e) => setSpec('length3', e.target.value)}
                      placeholder="قد ۳"
                      className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    />
                  )}
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
                    <button
                      type="button"
                      onClick={addCustomField}
                      className="btn btn-outline btn-sm text-xs"
                    >
                      <Plus className="h-3 w-3" />
                      افزودن فیلد
                    </button>
                  </div>
                  {(form.specs.customFields ?? []).map((cf, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
                      <div>
                        <input
                          type="text"
                          value={cf.label}
                          onChange={(e) => updateCustomField(i, { label: e.target.value })}
                          placeholder="عنوان"
                          className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                        />
                        <MemoryChips
                          values={specMemory.customLabel}
                          onPick={(v) => updateCustomField(i, { label: v })}
                          onDelete={(v) => deleteSpecMemoryValue('customLabel', v)}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={cf.value}
                          onChange={(e) => updateCustomField(i, { value: e.target.value })}
                          placeholder="مقدار"
                          className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                        />
                        {cf.label.trim() && (
                          <MemoryChips
                            values={specMemory[`custom:${cf.label.trim()}`]}
                            onPick={(v) => updateCustomField(i, { value: v })}
                            onDelete={(v) => deleteSpecMemoryValue(`custom:${cf.label.trim()}`, v)}
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomField(i)}
                        className="hover:text-error mt-2 text-gray-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="border-primary/15 bg-primary-50/40 space-y-3 rounded-xl border p-4">
                  <p className="text-primary-dark text-sm font-semibold">سئو سایت عمده (.com)</p>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Meta Title
                    </label>
                    <input
                      type="text"
                      value={form.wholesaleSeoTitle}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, wholesaleSeoTitle: e.target.value }))
                      }
                      className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      maxLength={70}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Meta Description
                    </label>
                    <textarea
                      value={form.wholesaleSeoDescription}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, wholesaleSeoDescription: e.target.value }))
                      }
                      rows={2}
                      maxLength={160}
                      className="focus:ring-primary/30 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Focus Keyword
                      </label>
                      <input
                        type="text"
                        value={form.wholesaleFocusKeyword}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, wholesaleFocusKeyword: e.target.value }))
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Canonical URL
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={form.wholesaleCanonical}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, wholesaleCanonical: e.target.value }))
                        }
                        placeholder="https://poshaktaranom.com/..."
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="mb-1 text-[11px] text-gray-400">پیش‌نمایش گوگل (عمده)</p>
                    <p className="truncate text-base text-[#1a0dab]">
                      {form.wholesaleSeoTitle || form.name || 'عنوان محصول'} | پوشاک ترنم
                    </p>
                    <p className="truncate text-xs text-[#006621]" dir="ltr">
                      {form.wholesaleCanonical || 'https://poshaktaranom.com/products/...'}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                      {form.wholesaleSeoDescription ||
                        form.description ||
                        'توضیح کوتاه محصول برای نتایج جستجو…'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                  <p className="text-sm font-semibold text-amber-900">سئو سایت تکی (.ir)</p>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Meta Title
                    </label>
                    <input
                      type="text"
                      value={form.retailSeoTitle}
                      onChange={(e) => setForm((f) => ({ ...f, retailSeoTitle: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                      maxLength={70}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Meta Description
                    </label>
                    <textarea
                      value={form.retailSeoDescription}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, retailSeoDescription: e.target.value }))
                      }
                      rows={2}
                      maxLength={160}
                      className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Focus Keyword
                      </label>
                      <input
                        type="text"
                        value={form.retailFocusKeyword}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, retailFocusKeyword: e.target.value }))
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Canonical URL
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={form.retailCanonical}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, retailCanonical: e.target.value }))
                        }
                        placeholder="https://poshaktaranom.ir/..."
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="mb-1 text-[11px] text-gray-400">پیش‌نمایش گوگل (تکی)</p>
                    <p className="truncate text-base text-[#1a0dab]">
                      {form.retailSeoTitle || form.name || 'عنوان محصول'} | فروشگاه ترنم
                    </p>
                    <p className="truncate text-xs text-[#006621]" dir="ltr">
                      {form.retailCanonical || 'https://poshaktaranom.ir/products/...'}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                      {form.retailSeoDescription ||
                        form.description ||
                        'توضیح کوتاه محصول برای نتایج جستجو…'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                <p className="text-sm font-semibold text-gray-800">توضیحات کامل و مراقبت</p>
                <p className="text-[11px] text-gray-400">
                  پیش‌نمایش ساخته‌شده فقط داخل همین فرم می‌آید؛ برای اعمال روی محصول باید ذخیره کنید.
                </p>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-medium text-gray-600">
                        متن کامل تک‌فروشی
                      </label>
                      <button
                        type="button"
                        disabled={contentBusy != null}
                        onClick={() => void generateContent('RETAIL')}
                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {contentBusy === 'RETAIL' ? 'در حال ساخت…' : 'ساخت متن تک‌فروشی'}
                      </button>
                    </div>
                    <textarea
                      dir="rtl"
                      value={form.retailFullContent}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, retailFullContent: e.target.value }))
                      }
                      rows={6}
                      placeholder="توضیح مصرف‌کننده نهایی — بدون زبان عمده‌فروشی"
                      className="focus:ring-primary/30 w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-medium text-gray-600">متن کامل عمده</label>
                      <button
                        type="button"
                        disabled={contentBusy != null}
                        onClick={() => void generateContent('WHOLESALE')}
                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {contentBusy === 'WHOLESALE' ? 'در حال ساخت…' : 'ساخت متن عمده‌فروشی'}
                      </button>
                    </div>
                    <textarea
                      dir="rtl"
                      value={form.wholesaleFullContent}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, wholesaleFullContent: e.target.value }))
                      }
                      rows={6}
                      placeholder="توضیح خرید عمده، پک و همکاری فروشگاهی"
                      className="focus:ring-primary/30 w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    />
                  </div>
                </div>
                {form.legacyContent.trim() ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="mb-1 text-xs font-medium text-gray-600">
                      متن قدیمی (فقط برای بازبینی)
                    </p>
                    <div
                      dir="rtl"
                      className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm text-gray-500"
                    >
                      {form.legacyContent}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {field('wholesalePrice', 'قیمت اصلی عمده‌فروشی', 'number', '125000')}
                {field(
                  'retailPrice',
                  form.showOnRetail ? 'قیمت اصلی تک‌فروشی *' : 'قیمت اصلی تک‌فروشی',
                  'number',
                  '180000'
                )}
              </div>
              <div className="space-y-2">
                <div className="max-w-xs">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    حداقل سفارش (تعداد پک)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.minOrderQty}
                    onChange={(e) => setForm((f) => ({ ...f, minOrderQty: e.target.value }))}
                    placeholder="1"
                    className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  />
                </div>
                <p className="text-[11px] text-gray-600">{packSummary}</p>
              </div>
              <p className="text-[11px] text-gray-500">
                قیمت اصلی پایه تخفیف است (تومان). سرور قیمت نهایی هر کانال را از تخفیف همان کانال حساب
                می‌کند. عمده همیشه الزامی است؛ تکی وقتی نمایش در تکی فعال است الزامی است.
              </p>

              <div className="border-primary-100 bg-primary-50/40 space-y-3 rounded-xl border p-4">
                <p className="text-xs font-bold text-gray-800">سفارش عمده — پک و رنگ</p>
                <p className="text-[11px] leading-relaxed text-gray-500">
                  فرمول پک عمده:{' '}
                  <span className="font-semibold text-gray-800">تعداد رنگ × تعداد سایز</span> (از هر
                  ترکیب رنگ/سایز یک عدد در هر پک). اگر انتخاب رنگ فعال باشد، فقط رنگ‌های انتخابی
                  مشتری در محاسبه می‌آید.
                </p>
                <div className="flex flex-wrap items-end gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.allowWholesaleColorSelect}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, allowWholesaleColorSelect: e.target.checked }))
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">اجازه انتخاب رنگ در سایت عمده</span>
                  </label>
                  {form.allowWholesaleColorSelect && (
                    <div className="w-40">
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        حداقل تعداد رنگ
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={form.minWholesaleColors}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, minWholesaleColors: e.target.value }))
                        }
                        className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">وضعیت</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  >
                    <option value="ACTIVE">فعال</option>
                    <option value="ARCHIVED">بایگانی</option>
                    <option value="OUT_OF_STOCK">ناموجود</option>
                    <option value="COMING_SOON">به زودی</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">نوع سایز</label>
                  <select
                    value={form.sizeType}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        sizeType: e.target.value as FormData['sizeType'],
                      }))
                    }
                    className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  >
                    <option value="TWO">محصول ۲ سایزی</option>
                    <option value="THREE">محصول ۳ سایزی</option>
                    <option value="FREE">فری سایز</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.showOnWholesale}
                    onChange={(e) => setForm((f) => ({ ...f, showOnWholesale: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">نمایش در سایت عمده</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.showOnRetail}
                    onChange={(e) => setForm((f) => ({ ...f, showOnRetail: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">نمایش در سایت تکی</span>
                </label>
              </div>

              <div className="space-y-3">
                <label className="block text-sm text-gray-700">
                  گارانتی ترب (اختیاری، حداکثر ۲۰۰ کاراکتر)
                  <textarea
                    value={form.guarantee}
                    maxLength={200}
                    onChange={(e) => setForm((f) => ({ ...f, guarantee: e.target.value }))}
                    className="focus:ring-primary/30 mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    rows={2}
                  />
                </label>
                <label className="block text-sm text-gray-700">
                  واریانت پیش‌فرض فروش تکی
                  <select
                    value={form.defaultRetailVariantId}
                    onChange={(e) => setForm((f) => ({ ...f, defaultRetailVariantId: e.target.value }))}
                    className="focus:ring-primary/30 mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  >
                    <option value="">انتخاب خودکار (موجودی تکی، سپس ترتیب ثابت)</option>
                    {(editProduct?.variants ?? []).map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.color} / {variant.size} — تکی {Number(variant.retailStock) || 0}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <ProductDiscountSettings
                value={{
                  wholesaleIsDiscounted: form.wholesaleIsDiscounted,
                  wholesaleDiscountType: form.wholesaleDiscountType,
                  wholesaleDiscountPercent: form.wholesaleDiscountPercent,
                  wholesaleDiscountAmount: form.wholesaleDiscountAmount,
                  wholesaleDiscountStartsAt: form.wholesaleDiscountStartsAt,
                  wholesaleDiscountEndsAt: form.wholesaleDiscountEndsAt,
                  retailIsDiscounted: form.retailIsDiscounted,
                  retailDiscountType: form.retailDiscountType,
                  retailDiscountPercent: form.retailDiscountPercent,
                  retailDiscountAmount: form.retailDiscountAmount,
                  retailDiscountStartsAt: form.retailDiscountStartsAt,
                  retailDiscountEndsAt: form.retailDiscountEndsAt,
                }}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                wholesaleBaseToman={Number(form.wholesalePrice) || 0}
                retailBaseToman={Number(form.retailPrice) || 0}
              />

              <div className="border-primary/30 bg-primary-50/40 space-y-3 rounded-xl border border-dashed p-4">
                <p className="text-primary text-xs font-bold">فروشگاه تکی</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">کالکشن</label>
                    <select
                      value={form.collectionId}
                      onChange={(e) => setForm((f) => ({ ...f, collectionId: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="">بدون کالکشن</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      لینک ویدیو
                    </label>
                    <input
                      type="url"
                      value={form.videoUrl}
                      onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                      placeholder="https://..."
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    اطلاعات مدل / تنخور
                  </label>
                  <textarea
                    value={form.modelInfo}
                    onChange={(e) => setForm((f) => ({ ...f, modelInfo: e.target.value }))}
                    rows={2}
                    placeholder="قد مدل ۱۷۵ — سایز پوشیده M"
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isPreOrder}
                    onChange={(e) => setForm((f) => ({ ...f, isPreOrder: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">پیش‌فروش (Pre-order)</span>
                </label>
                {form.isPreOrder ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      تاریخ عرضه
                    </label>
                    <input
                      type="date"
                      value={form.preOrderDate}
                      onChange={(e) => setForm((f) => ({ ...f, preOrderDate: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                ) : null}
              </div>

              <p className="rounded-lg bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-400">
                نشان «موجودی محدود» وقتی موجودی ≤ {badgeSettings.limitedStockMultiplier}× حداقل
                سفارش فعال می‌شود. نشان «جدید» برای {badgeSettings.newBadgeDays} روز پس از ایجاد
                محصول نمایش داده می‌شود. (قابل تنظیم از تنظیمات ← کسب‌وکار)
              </p>

              <ProductRelatedPicker
                value={relatedPicks}
                onChange={setRelatedPicks}
                excludeId={editProduct?.id}
              />

              <div>
                <ColorVariantsEditor
                  sizeLabels={sizeOptionsForType(form.sizeType)}
                  drafts={colorDrafts}
                  onChange={setColorDrafts}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-600">
                  گالری عمومی (اختیاری — علاوه بر عکس رنگ‌ها)
                </label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {images.map((url, i) => (
                    <div
                      key={url + i}
                      className="relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200"
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] text-white hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImg}
                    className="hover:border-primary hover:text-primary flex h-16 w-16 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-gray-400 transition-colors"
                  >
                    {uploadingImg ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    <span className="mt-1 text-[10px]">{uploadingImg ? '' : 'آپلود'}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  عکس اصلی هر رنگ را در بخش رنگ‌بندی آپلود کنید. این گالری فقط برای تصاویر
                  عمومی/اضافی است.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 bg-white px-6 py-4">
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

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="text-error h-6 w-6" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-gray-900">حذف محصول</h3>
            <p className="mb-6 text-sm text-gray-500">
              آیا مطمئن هستید؟ این عملیات قابل بازگشت نیست.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn btn-outline btn-md flex-1">
                انصراف
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="btn btn-md bg-error flex-1 text-white hover:bg-red-700"
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

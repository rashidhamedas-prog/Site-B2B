'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { cn } from '@/lib/cn';

export type SizeStock = { wholesale: string; retail: string };

export type ColorDraft = {
  key: string;
  color: string;
  colorHex: string;
  barcode: string;
  imageUrl: string;
  /** Existing color name when editing (for rename-safe delete) */
  originalColor?: string;
  sizeStocks: Record<string, SizeStock>;
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

export function emptySizeStocks(labels: string[]): Record<string, SizeStock> {
  const out: Record<string, SizeStock> = {};
  for (const l of labels) out[l] = { wholesale: '0', retail: '0' };
  return out;
}

export function ensureSizeStocks(
  stocks: Record<string, SizeStock> | undefined,
  labels: string[],
): Record<string, SizeStock> {
  const out: Record<string, SizeStock> = {};
  for (const l of labels) {
    out[l] = {
      wholesale: stocks?.[l]?.wholesale ?? '0',
      retail: stocks?.[l]?.retail ?? '0',
    };
  }
  return out;
}

export function emptyColorDraft(sizeLabels: string[] = ['فری']): ColorDraft {
  return {
    key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    color: '',
    colorHex: '#000000',
    barcode: '',
    imageUrl: '',
    sizeStocks: emptySizeStocks(sizeLabels),
  };
}

export function draftsFromVariants(
  variants: Array<{
    color: string;
    colorHex?: string;
    size?: string;
    barcode?: string;
    stock?: number;
    wholesaleStock?: number;
    retailStock?: number;
    imageUrl?: string | null;
  }>,
  sizeLabels: string[] = [],
): ColorDraft[] {
  const map = new Map<string, ColorDraft>();
  for (const v of variants) {
    const name = v.color || '—';
    const size = (v.size || '').trim() || 'فری';
    const w = Number(v.wholesaleStock) || Number(v.stock) || 0;
    const r = Number(v.retailStock) || 0;
    const existing = map.get(name);
    if (!existing) {
      const sizeStocks = emptySizeStocks(sizeLabels.length ? sizeLabels : [size]);
      sizeStocks[size] = { wholesale: String(w), retail: String(r) };
      map.set(name, {
        key: `c-${name}`,
        color: v.color,
        colorHex: v.colorHex || '#000000',
        barcode: v.barcode ?? '',
        imageUrl: v.imageUrl || '',
        originalColor: v.color,
        sizeStocks,
      });
    } else {
      existing.sizeStocks[size] = {
        wholesale: String(w),
        retail: String(r),
      };
      if (!existing.imageUrl && v.imageUrl) existing.imageUrl = v.imageUrl;
      if (!existing.barcode && v.barcode) existing.barcode = v.barcode;
    }
  }
  return Array.from(map.values()).map((d) => ({
    ...d,
    sizeStocks: ensureSizeStocks(
      d.sizeStocks,
      sizeLabels.length ? sizeLabels : Object.keys(d.sizeStocks),
    ),
  }));
}

function sumStocks(drafts: ColorDraft[], field: 'wholesale' | 'retail') {
  return drafts.reduce((sum, d) => {
    return (
      sum +
      Object.values(d.sizeStocks).reduce(
        (s, row) => s + (Number(row[field]) || 0),
        0,
      )
    );
  }, 0);
}

type Props = {
  sizeLabels: string[];
  drafts: ColorDraft[];
  onChange: (next: ColorDraft[]) => void;
};

export function ColorVariantsEditor({ sizeLabels, drafts, onChange }: Props) {
  const { upload, uploading } = useImageUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadKey, setUploadKey] = useState<string | null>(null);
  const [form, setForm] = useState<ColorDraft>(() => emptyColorDraft(sizeLabels));
  const [editKey, setEditKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep form + drafts aligned when product sizeType changes
  useEffect(() => {
    setForm((f) => ({ ...f, sizeStocks: ensureSizeStocks(f.sizeStocks, sizeLabels) }));
    const needsPad = drafts.some((d) =>
      sizeLabels.some((l) => !d.sizeStocks[l]),
    );
    if (needsPad) {
      onChange(
        drafts.map((d) => ({
          ...d,
          sizeStocks: ensureSizeStocks(d.sizeStocks, sizeLabels),
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when size labels change
  }, [sizeLabels.join('|')]);

  const totalW = sumStocks(drafts, 'wholesale');
  const totalR = sumStocks(drafts, 'retail');

  const setFormSizeStock = (
    size: string,
    field: 'wholesale' | 'retail',
    value: string,
  ) => {
    setForm((p) => ({
      ...p,
      sizeStocks: {
        ...p.sizeStocks,
        [size]: { ...p.sizeStocks[size], [field]: value },
      },
    }));
  };

  const startEdit = (d: ColorDraft) => {
    setEditKey(d.key);
    setForm({
      ...d,
      sizeStocks: ensureSizeStocks(d.sizeStocks, sizeLabels),
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditKey(null);
    setForm(emptyColorDraft(sizeLabels));
    setError(null);
  };

  const saveDraft = () => {
    const color = form.color.trim();
    if (!color) {
      setError('نام رنگ الزامی است');
      return;
    }
    const sizeStocks = ensureSizeStocks(form.sizeStocks, sizeLabels);
    for (const size of sizeLabels) {
      const w = Math.max(0, Math.floor(Number(sizeStocks[size].wholesale) || 0));
      const r = Math.max(0, Math.floor(Number(sizeStocks[size].retail) || 0));
      if (!Number.isFinite(w) || !Number.isFinite(r)) {
        setError(`موجودی سایز «${size}» نامعتبر است`);
        return;
      }
      sizeStocks[size] = { wholesale: String(w), retail: String(r) };
    }
    const dup = drafts.find((d) => d.color.trim() === color && d.key !== editKey);
    if (dup) {
      setError('این رنگ قبلاً اضافه شده است');
      return;
    }

    const next: ColorDraft = {
      ...form,
      color,
      sizeStocks,
      key: editKey || form.key || emptyColorDraft(sizeLabels).key,
      originalColor: form.originalColor || (editKey ? form.color : undefined),
    };

    if (editKey) {
      onChange(drafts.map((d) => (d.key === editKey ? next : d)));
    } else {
      onChange([...drafts, next]);
    }
    cancelEdit();
  };

  const removeDraft = (key: string) => {
    onChange(drafts.filter((d) => d.key !== key));
    if (editKey === key) cancelEdit();
  };

  const pickUpload = (key: string) => {
    setUploadKey(key);
    fileRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadKey) return;
    try {
      const url = await upload(file);
      if (uploadKey === 'form') {
        setForm((f) => ({ ...f, imageUrl: url }));
      } else {
        onChange(
          drafts.map((d) => (d.key === uploadKey ? { ...d, imageUrl: url } : d)),
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطا در آپلود تصویر');
    } finally {
      setUploadKey(null);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary-50/30 p-4">
      <div>
        <h4 className="text-sm font-bold text-gray-900">رنگ‌بندی · موجودی · عکس رنگ</h4>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
          برای هر رنگ، موجودی عمده و تکی را جداگانه برای هر سایز ({sizeLabels.join(' · ')}) ثبت کنید.
          آپلود عکس اختیاری است و در فروشگاه تکی با انتخاب همان رنگ هم‌گام می‌شود.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-end">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">نام رنگ</label>
            <input
              value={form.color}
              onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
              placeholder="مثلاً سبز یشمی"
              className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">کد رنگ</label>
            <input
              type="color"
              value={form.colorHex}
              onChange={(e) => setForm((p) => ({ ...p, colorHex: e.target.value }))}
              className="w-full h-[34px] rounded-lg border border-gray-200 cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">بارکد</label>
            <input
              value={form.barcode}
              onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))}
              placeholder="اختیاری"
              className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">عکس این رنگ</label>
            <div className="flex items-center gap-2">
              {form.imageUrl ? (
                <div className="relative h-9 w-9 rounded-lg overflow-hidden border border-gray-200">
                  <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, imageUrl: '' }))}
                    className="absolute inset-0 bg-black/40 text-white text-[10px] opacity-0 hover:opacity-100"
                  >
                    حذف
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => pickUpload('form')}
                disabled={uploading && uploadKey === 'form'}
                className="btn btn-outline btn-sm cursor-pointer flex items-center gap-1"
              >
                {uploading && uploadKey === 'form' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" />
                )}
                آپلود
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400">سایز</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400">موجودی عمده</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400">موجودی تکی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sizeLabels.map((size) => (
                <tr key={size}>
                  <td className="px-2 py-1.5 font-medium text-gray-700">{size}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      value={form.sizeStocks[size]?.wholesale ?? '0'}
                      onChange={(e) => setFormSizeStock(size, 'wholesale', e.target.value)}
                      className="w-full max-w-[120px] rounded-lg border border-gray-200 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      value={form.sizeStocks[size]?.retail ?? '0'}
                      onChange={(e) => setFormSizeStock(size, 'retail', e.target.value)}
                      className="w-full max-w-[120px] rounded-lg border border-gray-200 px-2 py-1 text-sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <p className="text-[10px] text-gray-400 mb-1">پالت سریع</p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_COLORS.map((c) => (
              <button
                key={c.hex + c.name}
                type="button"
                title={c.name}
                onClick={() => setForm((p) => ({ ...p, color: c.name, colorHex: c.hex }))}
                className={cn(
                  'h-6 w-6 rounded-full border border-gray-200 hover:scale-110 transition-transform cursor-pointer',
                  form.colorHex?.toLowerCase() === c.hex.toLowerCase() && 'ring-2 ring-primary ring-offset-1',
                )}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-error">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveDraft}
            className="btn btn-primary btn-sm cursor-pointer flex items-center gap-1"
          >
            {editKey ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {editKey ? 'بروزرسانی رنگ' : 'افزودن رنگ'}
          </button>
          {editKey && (
            <button type="button" onClick={cancelEdit} className="btn btn-outline btn-sm cursor-pointer">
              انصراف
            </button>
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {drafts.length === 0 ? (
        <p className="text-center text-xs text-gray-400 py-4">هنوز رنگی اضافه نشده</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400">عکس</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400">رنگ</th>
                {sizeLabels.map((s) => (
                  <th key={s} className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400">
                    {s}
                    <span className="block font-normal text-gray-300">عمده / تکی</span>
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {drafts.map((d) => (
                <tr key={d.key} className={cn(editKey === d.key && 'bg-primary-50')}>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => pickUpload(d.key)}
                      className="relative h-10 w-10 rounded-lg border border-dashed border-gray-200 overflow-hidden flex items-center justify-center text-gray-400 hover:border-primary cursor-pointer"
                      title="آپلود / تغییر عکس رنگ"
                    >
                      {d.imageUrl ? (
                        <img src={d.imageUrl} alt={d.color} className="h-full w-full object-cover" />
                      ) : uploading && uploadKey === d.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-4 w-4 rounded-full border border-gray-200"
                        style={{ backgroundColor: d.colorHex }}
                      />
                      <span className="font-medium">{d.color}</span>
                    </div>
                  </td>
                  {sizeLabels.map((s) => (
                    <td key={s} className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      <span className="text-primary font-semibold">
                        {d.sizeStocks[s]?.wholesale ?? '0'}
                      </span>
                      {' / '}
                      <span className="text-amber-700 font-semibold">
                        {d.sizeStocks[s]?.retail ?? '0'}
                      </span>
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(d)}
                        className="text-xs text-primary cursor-pointer"
                      >
                        ویرایش
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDraft(d.key)}
                        className="text-gray-400 hover:text-error cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      {d.imageUrl ? (
                        <button
                          type="button"
                          title="حذف عکس"
                          onClick={() =>
                            onChange(
                              drafts.map((x) => (x.key === d.key ? { ...x, imageUrl: '' } : x)),
                            )
                          }
                          className="text-gray-300 hover:text-error cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs font-semibold text-gray-700">
        {drafts.length} رنگ · جمع عمده{' '}
        <span className="text-primary tabular-nums">{totalW}</span>
        {' · '}
        جمع تکی <span className="text-amber-700 tabular-nums">{totalR}</span>
      </p>
    </div>
  );
}

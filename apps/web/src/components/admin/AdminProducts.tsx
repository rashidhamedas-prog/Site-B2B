'use client';

import { useState, useCallback, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, X, Save, Layers, ImagePlus, Loader2 } from 'lucide-react';
import { Input, Badge, Pagination } from '@/components/ui';
import { useProducts, Product } from '@/lib/hooks/useProducts';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'فعال', ARCHIVED: 'بایگانی', OUT_OF_STOCK: 'ناموجود',
};

const emptyForm = {
  sku: '', name: '', fabric: '', fabricComposition: '', description: '',
  wholesalePrice: '', retailPrice: '', minOrderQty: '5',
  status: 'ACTIVE', isFeatured: false, isNew: false,
};

const emptyVariantForm = { color: '', colorHex: '#000000', size: '', stock: '0', barcode: '' };

type FormData = typeof emptyForm;
type VariantForm = typeof emptyVariantForm;

interface Variant { id: string; color: string; colorHex: string; size: string; stock: number; barcode?: string; }

// ── Variant Management Modal ───────────────────────────────────

function VariantsModal({ product, onClose, onDone }: {
  product: Product; onClose: () => void; onDone: () => void;
}) {
  const [form, setForm] = useState<VariantForm>(emptyVariantForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>((product as any).variants ?? []);

  const refresh = useCallback(async () => {
    const res = await apiClient.get<{ variants: Variant[] }>(`/products/${product.id}`);
    setVariants((res as any).variants ?? []);
    onDone();
  }, [product.id, onDone]);

  const startEdit = (v: Variant) => {
    setEditId(v.id);
    setForm({ color: v.color, colorHex: v.colorHex, size: v.size, stock: String(v.stock), barcode: v.barcode ?? '' });
  };

  const cancelEdit = () => { setEditId(null); setForm(emptyVariantForm); };

  const handleSave = async () => {
    if (!form.color || !form.size) return;
    setSaving(true);
    try {
      const payload = { ...form, stock: Number(form.stock) };
      if (editId) {
        await apiClient.patch(`/products/${product.id}/variants/${editId}`, payload);
      } else {
        await apiClient.post(`/products/${product.id}/variants`, payload);
      }
      setEditId(null);
      setForm(emptyVariantForm);
      await refresh();
    } finally { setSaving(false); }
  };

  const handleDelete = async (variantId: string) => {
    await apiClient.delete(`/products/${product.id}/variants/${variantId}`);
    setDeletingId(null);
    await refresh();
  };

  const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '36', '38', '40', '42', '44', '46'];
  const f = (key: keyof VariantForm, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      <input type={type} value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">واریانت‌های محصول</h3>
            <p className="text-xs text-gray-400 mt-0.5">{product.name} — {product.sku}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {/* Add/Edit form */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-3">{editId ? 'ویرایش واریانت' : 'افزودن واریانت جدید'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
            {f('color', 'رنگ', 'text', 'سفید')}
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">کد رنگ</label>
              <input type="color" value={form.colorHex} onChange={(e) => setForm((p) => ({ ...p, colorHex: e.target.value }))}
                className="w-full h-[34px] rounded-lg border border-gray-200 cursor-pointer" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">سایز</label>
              <select value={form.size} onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30">
                <option value="">انتخاب</option>
                {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {f('stock', 'موجودی', 'number', '0')}
            {f('barcode', 'بارکد', 'text', 'اختیاری')}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleSave} disabled={saving || !form.color || !form.size}
              className="btn btn-primary btn-sm flex items-center gap-1.5">
              <Save className="h-3.5 w-3.5" />
              {saving ? 'ذخیره...' : editId ? 'بروزرسانی' : 'افزودن'}
            </button>
            {editId && (
              <button onClick={cancelEdit} className="btn btn-outline btn-sm">انصراف</button>
            )}
          </div>
        </div>

        {/* Variants list */}
        <div className="overflow-y-auto flex-1">
          {variants.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">واریانتی تعریف نشده — از فرم بالا اضافه کنید</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {['رنگ', 'سایز', 'موجودی', 'بارکد', ''].map((h) => (
                    <th key={h} className="px-4 py-2 text-right text-xs font-semibold text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {variants.map((v) => (
                  <tr key={v.id} className={cn('hover:bg-gray-50 transition-colors', editId === v.id && 'bg-primary-50')}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: v.colorHex }} />
                        <span>{v.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{v.size}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('font-bold', v.stock === 0 ? 'text-error' : v.stock < 5 ? 'text-warning' : 'text-success')}>
                        {v.stock}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{v.barcode || '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEdit(v)} className="text-gray-400 hover:text-primary"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setDeletingId(v.id)} className="text-gray-400 hover:text-error"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center">
          <p className="text-xs text-gray-400">{variants.length} واریانت ثبت شده</p>
          <button onClick={onClose} className="btn btn-outline btn-sm">بستن</button>
        </div>

        {/* Delete confirm */}
        {deletingId && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl">
            <div className="bg-white rounded-xl p-6 shadow-xl text-center">
              <p className="text-sm font-semibold text-gray-900 mb-4">حذف این واریانت؟</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingId(null)} className="btn btn-outline btn-sm">انصراف</button>
                <button onClick={() => handleDelete(deletingId)} className="btn btn-sm bg-error text-white hover:bg-red-700">حذف</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { products, meta, loading, refetch } = useProducts({
    page, search: search || undefined, limit: 20, status: 'ALL',
  });

  const openCreate = () => { setForm(emptyForm); setImages([]); setEditProduct(null); setModal('create'); };
  const openEdit = (p: Product) => {
    setEditProduct(p);
    setImages((p as any).images ?? []);
    setForm({
      sku: p.sku, name: p.name, fabric: p.fabric,
      fabricComposition: (p as any).fabricComposition ?? '',
      description: (p as any).description ?? '',
      wholesalePrice: String(Math.round(Number(p.wholesalePrice) / 10)),
      retailPrice: p.retailPrice ? String(Math.round(Number(p.retailPrice) / 10)) : '',
      minOrderQty: String(p.minOrderQty),
      status: p.status, isFeatured: p.isFeatured, isNew: p.isNew,
    });
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setEditProduct(null); setImages([]); }

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [uploadImage]);

  const handleSave = useCallback(async () => {
    if (!form.sku || !form.name || !form.fabric || !form.wholesalePrice) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        wholesalePrice: Number(form.wholesalePrice) * 10,
        retailPrice: form.retailPrice ? Number(form.retailPrice) * 10 : null,
        minOrderQty: Number(form.minOrderQty),
        images,
      };
      if (modal === 'create') await apiClient.post('/products', payload);
      else if (modal === 'edit' && editProduct) await apiClient.patch(`/products/${editProduct.id}`, payload);
      closeModal(); refetch();
    } finally { setSaving(false); }
  }, [form, modal, editProduct, refetch, images]);

  const handleDelete = useCallback(async (id: string) => {
    try { await apiClient.delete(`/products/${id}`); setDeleteId(null); refetch(); } catch {}
  }, [refetch]);

  const field = (key: keyof FormData, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">محصولات</h2>
          <p className="text-sm text-gray-500 mt-0.5">{meta.total} مدل در کاتالوگ</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary btn-md flex items-center gap-2">
          <Plus className="h-4 w-4" />افزودن محصول
        </button>
      </div>

      <div className="w-72">
        <Input placeholder="جستجو نام، SKU، پارچه..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          rightIcon={<Search className="h-4 w-4" />} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['SKU', 'نام محصول', 'پارچه', 'واریانت‌ها', 'موجودی کل', 'قیمت عمده (ت)', 'وضعیت', ''].map((h) => (
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
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center">
                  <p className="text-gray-400 mb-3">محصولی یافت نشد</p>
                  <button onClick={openCreate} className="btn btn-primary btn-sm">افزودن اولین محصول</button>
                </td></tr>
              ) : products.map((p) => {
                const totalStock = (p as any).variants?.reduce((s: number, v: Variant) => s + v.stock, 0) ?? 0;
                const varCount = (p as any).variants?.length ?? 0;
                const lowStock = totalStock > 0 && totalStock < 10;
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-gray-400">{p.sku}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                        {p.isFeatured && <Badge variant="gold" className="text-[10px] px-1.5 py-0">ویژه</Badge>}
                        {p.isNew && <Badge variant="primary" className="text-[10px] px-1.5 py-0">جدید</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.fabric}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setVariantProduct(p)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                        <Layers className="h-3.5 w-3.5" />
                        {varCount} واریانت
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-sm font-bold', lowStock ? 'text-amber-600' : totalStock === 0 ? 'text-error' : 'text-gray-700')}>
                        {totalStock} عدد
                      </span>
                      {lowStock && <span className="text-[10px] text-amber-500 block">کم موجودی</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">
                      {(Number(p.wholesalePrice) / 10).toLocaleString('fa-IR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-primary transition-colors" title="ویرایش">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteId(p.id)} className="text-gray-400 hover:text-error transition-colors" title="حذف">
                          <Trash2 className="h-4 w-4" />
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

      {/* Create/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {modal === 'create' ? 'افزودن محصول جدید' : 'ویرایش محصول'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {field('sku', 'کد SKU', 'text', 'MANTO-XXX-001')}
                {field('name', 'نام محصول', 'text', 'مانتو بهار')}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {field('fabric', 'جنس پارچه', 'text', 'لینن')}
                {field('fabricComposition', 'ترکیب پارچه', 'text', '100% لینن')}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">توضیحات</label>
                <textarea value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                {field('wholesalePrice', 'قیمت عمده (تومان)', 'number', '125000')}
                {field('retailPrice', 'قیمت تکی (تومان)', 'number', '180000')}
                {field('minOrderQty', 'حداقل سفارش', 'number', '5')}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">وضعیت</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="ACTIVE">فعال</option>
                  <option value="ARCHIVED">بایگانی</option>
                  <option value="OUT_OF_STOCK">ناموجود</option>
                </select>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-gray-700">محصول ویژه</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isNew} onChange={(e) => setForm((f) => ({ ...f, isNew: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-gray-700">محصول جدید</span>
                </label>
              </div>
              {/* Image upload */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">تصاویر محصول</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {images.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] hover:bg-red-600"
                      >×</button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImg}
                    className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-colors"
                  >
                    {uploadingImg ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    <span className="text-[10px] mt-1">{uploadingImg ? '' : 'آپلود'}</span>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </div>
                <p className="text-[11px] text-gray-400">حداکثر ۵ مگابایت — JPG، PNG، WebP</p>
              </div>
              {modal === 'create' && (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                  بعد از ذخیره، واریانت‌ها (رنگ/سایز) را از دکمه «واریانت‌ها» اضافه کنید
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeModal} className="btn btn-outline btn-md">انصراف</button>
              <button onClick={handleSave} disabled={saving || !form.sku || !form.name || !form.fabric || !form.wholesalePrice}
                className="btn btn-primary btn-md flex items-center gap-2">
                <Save className="h-4 w-4" />{saving ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variant Management Modal */}
      {variantProduct && (
        <VariantsModal
          product={variantProduct}
          onClose={() => setVariantProduct(null)}
          onDone={refetch}
        />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-6 w-6 text-error" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">حذف محصول</h3>
            <p className="text-sm text-gray-500 mb-6">آیا مطمئن هستید؟ این عملیات قابل بازگشت نیست.</p>
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

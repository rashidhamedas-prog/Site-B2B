'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Edit2, Trash2, X, Save, Eye, FileText, ImagePlus, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { cn } from '@/lib/cn';

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  content: string;
  category: string;
  status: string;
  views: number;
  publishedAt?: string;
  createdAt: string;
  seoTitle?: string;
  seoDescription?: string;
  coverImage?: string;
}

const emptyForm = {
  title: '', slug: '', excerpt: '', content: '',
  category: 'عمومی', status: 'DRAFT', seoTitle: '', seoDescription: '',
  coverImage: '',
};

const CATEGORIES = ['عمومی', 'راهنمای پارچه', 'راهنمای کسب‌وکار', 'ترند فصلی', 'مدیریت بوتیک'];

export function AdminBlog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { upload: uploadImage, uploading: uploadingCover } = useImageUpload();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<Post[]>('/blog/admin/posts');
      setPosts(res);
    } catch { setPosts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(emptyForm); setEditId(null); setModal(true); };
  const openEdit = (p: Post) => {
    setEditId(p.id);
    setForm({
      title: p.title, slug: p.slug, excerpt: p.excerpt ?? '', content: p.content,
      category: p.category, status: p.status,
      seoTitle: p.seoTitle ?? '', seoDescription: p.seoDescription ?? '',
      coverImage: p.coverImage ?? '',
    });
    setModal(true);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, coverImage: url }));
    } catch {
      alert('آپلود تصویر شاخص با خطا مواجه شد');
    } finally {
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    setSaving(true);
    try {
      if (editId) await apiClient.put(`/blog/admin/posts/${editId}`, form);
      else await apiClient.post('/blog/admin/posts', form);
      setModal(false);
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'خطا در ذخیره مطلب');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await apiClient.delete(`/blog/admin/posts/${id}`); setDeleteId(null); await load(); } catch {}
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">وبلاگ</h2>
          <p className="text-sm text-gray-500 mt-0.5">{posts.length} مطلب — مقالات سئو و راهنمای مشتریان</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary btn-md flex items-center gap-2">
          <Plus className="h-4 w-4" />مطلب جدید
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['عنوان', 'دسته', 'وضعیت', 'بازدید', 'تاریخ', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-20" /></td>
                ))}</tr>
              )) : posts.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center">
                  <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 mb-3">مطلبی ثبت نشده</p>
                  <button onClick={openCreate} className="btn btn-primary btn-sm">نوشتن اولین مطلب</button>
                </td></tr>
              ) : posts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">{p.title}</p>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">/{p.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{p.category}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      p.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {p.status === 'PUBLISHED' ? 'منتشر شده' : 'پیش‌نویس'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{p.views.toLocaleString('fa-IR')}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(p.publishedAt ?? p.createdAt).toLocaleDateString('fa-IR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-primary" title="ویرایش">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteId(p.id)} className="text-gray-400 hover:text-error" title="حذف">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{editId ? 'ویرایش مطلب' : 'مطلب جدید'}</h3>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">عنوان *</label>
                  <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">اسلاگ (آدرس)</label>
                  <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="خالی = خودکار از عنوان" dir="ltr"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">دسته‌بندی</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">وضعیت</label>
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="DRAFT">پیش‌نویس</option>
                    <option value="PUBLISHED">انتشار</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">تصویر شاخص</label>
                <div className="flex items-start gap-3">
                  {form.coverImage ? (
                    <div className="relative w-24 h-16 rounded-lg overflow-hidden border border-gray-200">
                      <img src={form.coverImage} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, coverImage: '' }))}
                        className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] hover:bg-red-600"
                      >×</button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploadingCover}
                    className="w-24 h-16 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-colors"
                  >
                    {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    <span className="text-[10px] mt-1">{uploadingCover ? '' : 'آپلود'}</span>
                  </button>
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">خلاصه (برای فهرست و سئو)</label>
                <textarea value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  متن مطلب * <span className="text-gray-400 font-normal">(## عنوان بخش — ### زیرعنوان — - لیست — **پررنگ**)</span>
                </label>
                <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={12} dir="rtl"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <details className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <summary className="text-xs font-semibold text-gray-500 cursor-pointer">تنظیمات سئو (اختیاری)</summary>
                <div className="mt-3 space-y-3">
                  <input value={form.seoTitle} onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
                    placeholder="عنوان سئو"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none" />
                  <textarea value={form.seoDescription} onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
                    placeholder="توضیحات متا (۱۵۰ کاراکتر)" rows={2}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none resize-none" />
                </div>
              </details>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setModal(false)} className="btn btn-outline btn-md">انصراف</button>
              <button onClick={handleSave} disabled={saving || !form.title || !form.content}
                className="btn btn-primary btn-md flex items-center gap-2">
                <Save className="h-4 w-4" />{saving ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-6 w-6 text-error" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">حذف مطلب</h3>
            <p className="text-sm text-gray-500 mb-6">این مطلب از وبلاگ حذف می‌شود.</p>
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

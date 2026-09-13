'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { channelLabel } from './AdminChannelTabs';
import { useAdminBlogWorkspace } from './AdminBlogWorkspace';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  robotsIndex?: boolean;
}

interface TagRow {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  robotsIndex?: boolean;
}

const emptyCat = { name: '', slug: '', description: '', seoTitle: '', metaDescription: '', robotsIndex: true };
const emptyTag = { name: '', slug: '', description: '', robotsIndex: true };

export function AdminBlogTaxonomy() {
  const { channel, syncEpoch, bump } = useAdminBlogWorkspace();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [catForm, setCatForm] = useState(emptyCat);
  const [tagForm, setTagForm] = useState(emptyTag);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editTagId, setEditTagId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, tgs] = await Promise.all([
        apiClient.get<CategoryRow[]>(`/blog/admin/categories?channel=${channel}`),
        apiClient.get<TagRow[]>(`/blog/admin/tags?channel=${channel}`),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setTags(Array.isArray(tgs) ? tgs : []);
      setLoadError(null);
    } catch (err: unknown) {
      setCategories([]);
      setTags([]);
      setLoadError(err instanceof Error ? err.message : 'بارگذاری ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    void load();
  }, [load, syncEpoch]);

  const saveCategory = async () => {
    if (!catForm.name.trim()) return;
    try {
      if (editCatId) {
        await apiClient.patch(`/blog/admin/categories/${editCatId}`, { ...catForm, channel });
      } else {
        await apiClient.post('/blog/admin/categories', { ...catForm, channel });
      }
      setCatForm(emptyCat);
      setEditCatId(null);
      bump();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا');
    }
  };

  const saveTag = async () => {
    if (!tagForm.name.trim()) return;
    try {
      if (editTagId) {
        await apiClient.patch(`/blog/admin/tags/${editTagId}`, { ...tagForm, channel });
      } else {
        await apiClient.post('/blog/admin/tags', { ...tagForm, channel });
      }
      setTagForm(emptyTag);
      setEditTagId(null);
      bump();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">دسته‌ها و برچسب‌ها</h2>
        <p className="text-xs text-gray-500">
          {channelLabel(channel)} — صفحات عمومی /blog/category و /blog/tag همین کانال
        </p>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {loadError}
          <button type="button" className="btn btn-outline btn-sm mr-2" onClick={() => void load()}>
            تلاش مجدد
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3 p-4">
          <h3 className="text-sm font-bold">{editCatId ? 'ویرایش دسته' : 'دسته‌بندی'}</h3>
          <div className="grid gap-2">
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="نام دسته *"
              value={catForm.name}
              onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              dir="ltr"
              placeholder="slug (اختیاری)"
              value={catForm.slug}
              onChange={(e) => setCatForm((f) => ({ ...f, slug: e.target.value }))}
            />
            <textarea
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              rows={2}
              placeholder="توضیح"
              value={catForm.description}
              onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
            />
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="SEO Title"
              value={catForm.seoTitle}
              onChange={(e) => setCatForm((f) => ({ ...f, seoTitle: e.target.value }))}
            />
            <textarea
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              rows={2}
              placeholder="Meta Description"
              value={catForm.metaDescription}
              onChange={(e) => setCatForm((f) => ({ ...f, metaDescription: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={catForm.robotsIndex}
                onChange={(e) => setCatForm((f) => ({ ...f, robotsIndex: e.target.checked }))}
              />
              ایندکس در گوگل
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm inline-flex w-fit items-center gap-1"
                onClick={() => void saveCategory()}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {editCatId ? 'ذخیره دسته' : 'افزودن دسته'}
              </button>
              {editCatId ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setEditCatId(null);
                    setCatForm(emptyCat);
                  }}
                >
                  انصراف
                </button>
              ) : null}
            </div>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-gray-400">در حال بارگذاری…</p>
            ) : categories.length === 0 ? (
              <p className="text-xs text-gray-400">دسته‌ای برای این کانال نیست. از «Seed دسته» در مقالات استفاده کنید.</p>
            ) : (
              categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-50 px-2 py-1.5 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold">{c.name}</p>
                    <p className="font-mono text-[10px] text-gray-400" dir="ltr">
                      /blog/category/{c.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="text-gray-400 hover:text-primary"
                      aria-label={`ویرایش دسته ${c.name}`}
                      onClick={() => {
                        setEditCatId(c.id);
                        setCatForm({
                          name: c.name,
                          slug: c.slug,
                          description: c.description || '',
                          seoTitle: c.seoTitle || '',
                          metaDescription: c.metaDescription || '',
                          robotsIndex: c.robotsIndex !== false,
                        });
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="text-error"
                      aria-label={`حذف دسته ${c.name}`}
                      onClick={async () => {
                        if (!window.confirm(`حذف دسته «${c.name}»؟`)) return;
                        try {
                          await apiClient.delete(`/blog/admin/categories/${c.id}`);
                          bump();
                        } catch (e: unknown) {
                          alert(e instanceof Error ? e.message : 'حذف ناموفق');
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card space-y-3 p-4">
          <h3 className="text-sm font-bold">{editTagId ? 'ویرایش برچسب' : 'برچسب'}</h3>
          <div className="grid gap-2">
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="نام برچسب *"
              value={tagForm.name}
              onChange={(e) => setTagForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
              dir="ltr"
              placeholder="slug (اختیاری)"
              value={tagForm.slug}
              onChange={(e) => setTagForm((f) => ({ ...f, slug: e.target.value }))}
            />
            <textarea
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              rows={2}
              placeholder="توضیح"
              value={tagForm.description}
              onChange={(e) => setTagForm((f) => ({ ...f, description: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={tagForm.robotsIndex}
                onChange={(e) => setTagForm((f) => ({ ...f, robotsIndex: e.target.checked }))}
              />
              ایندکس در گوگل
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary btn-sm inline-flex w-fit items-center gap-1" onClick={() => void saveTag()}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {editTagId ? 'ذخیره برچسب' : 'افزودن برچسب'}
              </button>
              {editTagId ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setEditTagId(null);
                    setTagForm(emptyTag);
                  }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  انصراف
                </button>
              ) : null}
            </div>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-gray-400">در حال بارگذاری…</p>
            ) : tags.length === 0 ? (
              <p className="text-xs text-gray-400">برچسبی ثبت نشده.</p>
            ) : (
              tags.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-50 px-2 py-1.5 text-xs">
                  <div>
                    <p className="font-semibold">#{t.name}</p>
                    <p className="font-mono text-[10px] text-gray-400" dir="ltr">
                      /blog/tag/{t.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="text-gray-400 hover:text-primary"
                      aria-label={`ویرایش برچسب ${t.name}`}
                      onClick={() => {
                        setEditTagId(t.id);
                        setTagForm({
                          name: t.name,
                          slug: t.slug,
                          description: t.description || '',
                          robotsIndex: t.robotsIndex !== false,
                        });
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="text-error"
                      aria-label={`حذف برچسب ${t.name}`}
                      onClick={async () => {
                        if (!window.confirm(`حذف برچسب «${t.name}»؟`)) return;
                        try {
                          await apiClient.delete(`/blog/admin/tags/${t.id}`);
                          bump();
                        } catch (e: unknown) {
                          alert(e instanceof Error ? e.message : 'حذف ناموفق');
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="text-[10px] text-gray-400">
            با ذخیره مقاله، برچسب‌های متنی همان کانال به‌صورت خودکار اینجا هم ثبت می‌شوند.
          </p>
        </div>
      </div>
    </div>
  );
}

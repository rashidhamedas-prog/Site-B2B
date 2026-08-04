'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { AdminChannelTabs, channelLabel, type AdminChannel } from './AdminChannelTabs';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  robotsIndex?: boolean;
}

interface TagRow {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  robotsIndex?: boolean;
}

export function AdminBlogTaxonomy() {
  const [channel, setChannel] = useState<AdminChannel>('WHOLESALE');
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [catForm, setCatForm] = useState({ name: '', slug: '', description: '' });
  const [tagForm, setTagForm] = useState({ name: '', slug: '', description: '' });

  const load = useCallback(async () => {
    try {
      const [cats, tgs] = await Promise.all([
        apiClient.get<CategoryRow[]>(`/blog/admin/categories?channel=${channel}`),
        apiClient.get<TagRow[]>(`/blog/admin/tags?channel=${channel}`),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setTags(Array.isArray(tgs) ? tgs : []);
    } catch {
      setCategories([]);
      setTags([]);
    }
  }, [channel]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">دسته‌ها و برچسب‌ها</h2>
          <p className="text-xs text-gray-500">{channelLabel(channel)} — برای صفحات /blog/category و /blog/tag</p>
        </div>
        <AdminChannelTabs value={channel} onChange={setChannel} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3 p-4">
          <h3 className="text-sm font-bold">دسته‌بندی</h3>
          <div className="grid gap-2">
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="نام دسته *"
              value={catForm.name}
              onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
              dir="ltr"
              placeholder="slug (اختیاری)"
              value={catForm.slug}
              onChange={(e) => setCatForm((f) => ({ ...f, slug: e.target.value }))}
            />
            <textarea
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              rows={2}
              placeholder="توضیح"
              value={catForm.description}
              onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm inline-flex w-fit items-center gap-1"
              onClick={async () => {
                if (!catForm.name.trim()) return;
                try {
                  await apiClient.post('/blog/admin/categories', { ...catForm, channel });
                  setCatForm({ name: '', slug: '', description: '' });
                  await load();
                } catch (e: unknown) {
                  alert(e instanceof Error ? e.message : 'خطا');
                }
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              افزودن دسته
            </button>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-50 px-2 py-1.5 text-xs">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="font-mono text-[10px] text-gray-400" dir="ltr">
                    /blog/category/{c.slug}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-error"
                  onClick={async () => {
                    await apiClient.delete(`/blog/admin/categories/${c.id}`);
                    await load();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card space-y-3 p-4">
          <h3 className="text-sm font-bold">برچسب</h3>
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
            <button
              type="button"
              className="btn btn-primary btn-sm inline-flex w-fit items-center gap-1"
              onClick={async () => {
                if (!tagForm.name.trim()) return;
                try {
                  await apiClient.post('/blog/admin/tags', {
                    ...tagForm,
                    channel,
                    robotsIndex: true,
                  });
                  setTagForm({ name: '', slug: '', description: '' });
                  await load();
                } catch (e: unknown) {
                  alert(e instanceof Error ? e.message : 'خطا');
                }
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              افزودن برچسب
            </button>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {tags.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-50 px-2 py-1.5 text-xs">
                <div>
                  <p className="font-semibold">#{t.name}</p>
                  <p className="font-mono text-[10px] text-gray-400" dir="ltr">
                    /blog/tag/{t.slug}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-error"
                  onClick={async () => {
                    await apiClient.delete(`/blog/admin/tags/${t.id}`);
                    await load();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400">
            با ذخیره مقاله، برچسب‌های متنی به‌صورت خودکار در این جدول هم ثبت می‌شوند.
          </p>
        </div>
      </div>
    </div>
  );
}

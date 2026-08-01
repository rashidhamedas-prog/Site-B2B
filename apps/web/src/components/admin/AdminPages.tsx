'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X, Save, FileText, Loader2 } from 'lucide-react';
import { asciiSlug } from '@taranom/persian-utils';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { AdminChannelTabs, channelLabel, type AdminChannel } from './AdminChannelTabs';
import { AdminBlockEditor, type ContentBlock } from './AdminBlockEditor';

interface CmsPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  kind: string;
  channel: string;
  blocks: ContentBlock[];
  status: string;
  seoTitle?: string;
  seoDescription?: string;
  updatedAt?: string;
}

const emptyForm = {
  title: '',
  slug: '',
  content: '',
  status: 'DRAFT',
  seoTitle: '',
  seoDescription: '',
  blocks: [] as ContentBlock[],
};

function toSlug(text: string) {
  return asciiSlug(text, 'page');
}

export function AdminPages() {
  const [channel, setChannel] = useState<AdminChannel>('WHOLESALE');
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<CmsPage[]>(`/cms/admin/pages?channel=${channel}`);
      const list = Array.isArray(res) ? res : [];
      const filtered = list.some((p) => p.channel)
        ? list.filter((p) => !p.channel || p.channel === channel)
        : list;
      setPages(filtered);
    } catch {
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setModal(true);
  };

  const openEdit = (p: CmsPage) => {
    setEditId(p.id);
    setForm({
      title: p.title,
      slug: p.slug,
      content: p.content ?? '',
      status: p.status || 'DRAFT',
      seoTitle: p.seoTitle ?? '',
      seoDescription: p.seoDescription ?? '',
      blocks: Array.isArray(p.blocks) ? (p.blocks as ContentBlock[]) : [],
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.slug.trim()) {
      alert('عنوان و اسلاگ الزامی است');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        channel,
        title: form.title,
        slug: form.slug,
        content: form.content,
        blocks: form.blocks,
        status: form.status,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
        kind: 'PAGE',
      };
      if (editId) await apiClient.put(`/cms/admin/pages/${editId}`, payload);
      else await apiClient.post('/cms/admin/pages', payload);
      setModal(false);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در ذخیره صفحه');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('این صفحه حذف شود؟')) return;
    try {
      await apiClient.delete(`/cms/admin/pages/${id}`);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در حذف');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">صفحات سایت</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            صفحات CMS برای کانال {channelLabel(channel)}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AdminChannelTabs value={channel} onChange={setChannel} />
          <button type="button" onClick={openCreate} className="btn btn-primary btn-md flex items-center gap-2 cursor-pointer">
            <Plus className="h-4 w-4" />صفحه جدید
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['عنوان', 'اسلاگ', 'وضعیت', 'به‌روزرسانی', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">در حال بارگذاری...</td></tr>
              ) : pages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-gray-400">صفحه‌ای ثبت نشده</p>
                  </td>
                </tr>
              ) : pages.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{p.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500" dir="ltr">{p.slug}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      p.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
                    )}>
                      {p.status === 'PUBLISHED' ? 'منتشر شده' : 'پیش‌نویس'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('fa-IR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button type="button" onClick={() => openEdit(p)} className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(p.id)} className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-error">
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

      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-8 w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-bold text-gray-900">
                {editId ? 'ویرایش صفحه' : 'صفحه جدید'} — {channelLabel(channel)}
              </h3>
              <button type="button" onClick={() => setModal(false)} className="cursor-pointer text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">عنوان</label>
                  <input
                    value={form.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      setForm((f) => ({
                        ...f,
                        title,
                        slug: editId ? f.slug : toSlug(title) || f.slug,
                      }));
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">اسلاگ</label>
                  <input
                    dir="ltr"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">وضعیت</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="DRAFT">پیش‌نویس</option>
                    <option value="PUBLISHED">منتشر شده</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">عنوان سئو</label>
                  <input
                    value={form.seoTitle}
                    onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">توضیح سئو</label>
                <textarea
                  rows={2}
                  value={form.seoDescription}
                  onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">متن ساده / Markdown (اختیاری)</label>
                <textarea
                  rows={3}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <AdminBlockEditor
                blocks={form.blocks}
                onChange={(blocks) => setForm((f) => ({ ...f, blocks }))}
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button type="button" onClick={() => setModal(false)} className="btn btn-outline btn-md cursor-pointer">انصراف</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary btn-md flex items-center gap-2 cursor-pointer">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

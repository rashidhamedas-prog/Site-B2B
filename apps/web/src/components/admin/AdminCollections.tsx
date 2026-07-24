'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';

type Collection = {
  id: string;
  name: string;
  slug: string;
  season?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
};

const empty = { name: '', season: '', description: '', imageUrl: '', isActive: true };

export function AdminCollections() {
  const [rows, setRows] = useState<Collection[]>([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Collection[]>('/collections');
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'خطا در بارگذاری');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await apiClient.patch(`/collections/${editId}`, form);
      } else {
        await apiClient.post('/collections', form);
      }
      setForm(empty);
      setEditId(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'خطا در ذخیره');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c: Collection) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      season: c.season || '',
      description: c.description || '',
      imageUrl: c.imageUrl || '',
      isActive: c.isActive !== false,
    });
  };

  const remove = async (id: string) => {
    if (!confirm('حذف این کالکشن؟')) return;
    await apiClient.delete(`/collections/${id}`);
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">کالکشن‌ها</h1>
        <p className="mt-1 text-sm text-gray-500">مدیریت کالکشن‌های فروشگاه تکی</p>
      </div>

      <form onSubmit={submit} className="card space-y-3 p-5 max-w-2xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">نام</label>
            <input
              required
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">فصل</label>
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={form.season}
              onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
              placeholder="بهار ۱۴۰۵"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">توضیح</label>
          <textarea
            className="w-full rounded-lg border px-3 py-2 text-sm"
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">آدرس تصویر</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={form.imageUrl}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
            dir="ltr"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          فعال در ویترین
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editId ? 'ذخیره' : 'افزودن'}
          </button>
          {editId ? (
            <button
              type="button"
              className="rounded-lg border px-4 py-2 text-sm"
              onClick={() => {
                setEditId(null);
                setForm(empty);
              }}
            >
              انصراف
            </button>
          ) : null}
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border bg-white">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-400">در حال بارگذاری…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">کالکشنی نیست</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-right text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3">نام</th>
                <th className="px-4 py-3">فصل</th>
                <th className="px-4 py-3">وضعیت</th>
                <th className="px-4 py-3">اقدام</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3">{c.season || '—'}</td>
                  <td className="px-4 py-3">{c.isActive === false ? 'غیرفعال' : 'فعال'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" className="text-xs font-bold text-primary" onClick={() => startEdit(c)}>
                        ویرایش
                      </button>
                      <button type="button" className="text-xs font-bold text-red-600" onClick={() => remove(c.id)}>
                        <Trash2 className="inline h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

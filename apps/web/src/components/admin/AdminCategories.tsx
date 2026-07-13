'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

type Category = {
  id: string;
  name: string;
  skuPrefix: string;
  nextSequence: number;
};

export function AdminCategories() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrefix, setNewPrefix] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<Category[]>('/categories');
      setItems(res ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setSavingId('new');
    try {
      await apiClient.post('/categories', { name: newName.trim(), skuPrefix: newPrefix.trim() });
      setNewName('');
      setNewPrefix('');
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const save = async (c: Category) => {
    setSavingId(c.id);
    try {
      await apiClient.patch(`/categories/${c.id}`, {
        name: c.name,
        skuPrefix: c.skuPrefix,
        nextSequence: c.nextSequence,
      });
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('حذف دسته‌بندی؟')) return;
    setSavingId(id);
    try {
      await apiClient.delete(`/categories/${id}`);
      await load();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">دسته‌بندی‌ها</h1>
        <p className="text-sm text-gray-500 mt-1">مدیریت دسته‌بندی‌ها و فرمول SKU (Prefix + Sequence)</p>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-800">افزودن دسته‌بندی</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">نام</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              className="w-full input-base" placeholder="مثلاً مانتو لینن" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">پیشوند SKU</label>
            <input value={newPrefix} onChange={(e) => setNewPrefix(e.target.value)}
              className="w-full input-base" placeholder="LINEN-" dir="ltr" />
          </div>
          <button onClick={create} disabled={savingId === 'new'}
            className="btn btn-primary btn-md mt-6 sm:mt-0 flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            افزودن
          </button>
        </div>
        <p className="text-xs text-gray-400">نمونه SKU: <span className="font-mono">LINEN-00001</span></p>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">لیست</h2>
          <button onClick={load} className="btn btn-outline btn-sm" disabled={loading}>بروزرسانی</button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-gray-500">در حال بارگذاری...</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map((c) => (
              <div key={c.id} className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                <div className="lg:col-span-4">
                  <label className="block text-xs text-gray-600 mb-1">نام</label>
                  <input
                    value={c.name}
                    onChange={(e) => setItems((p) => p.map((x) => x.id === c.id ? { ...x, name: e.target.value } : x))}
                    className="w-full input-base"
                  />
                </div>
                <div className="lg:col-span-3">
                  <label className="block text-xs text-gray-600 mb-1">پیشوند SKU</label>
                  <input
                    dir="ltr"
                    value={c.skuPrefix ?? ''}
                    onChange={(e) => setItems((p) => p.map((x) => x.id === c.id ? { ...x, skuPrefix: e.target.value } : x))}
                    className="w-full input-base"
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">Sequence بعدی</label>
                  <input
                    type="number"
                    min={1}
                    value={c.nextSequence ?? 1}
                    onChange={(e) => setItems((p) => p.map((x) => x.id === c.id ? { ...x, nextSequence: Number(e.target.value) || 1 } : x))}
                    className="w-full input-base"
                  />
                </div>
                <div className="lg:col-span-3 flex items-center gap-2">
                  <button
                    onClick={() => save(c)}
                    disabled={savingId === c.id}
                    className={cn('btn btn-primary btn-sm flex items-center gap-1.5', savingId === c.id && 'opacity-60')}
                  >
                    <Save className="h-4 w-4" /> ذخیره
                  </button>
                  <button
                    onClick={() => remove(c.id)}
                    disabled={savingId === c.id}
                    className="btn btn-outline btn-sm text-error flex items-center gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" /> حذف
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="p-6 text-sm text-gray-500">هیچ دسته‌بندی‌ای ثبت نشده است.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { AdminChannelTabs, channelLabel, type AdminChannel } from './AdminChannelTabs';

interface RedirectRow {
  id: string;
  channel: string;
  sourcePath: string;
  destinationUrl: string;
  statusCode: number;
  reason: string;
  isActive: boolean;
  hitCount: number;
}

export function AdminBlogRedirects() {
  const [channel, setChannel] = useState<AdminChannel>('WHOLESALE');
  const [rows, setRows] = useState<RedirectRow[]>([]);
  const [sourcePath, setSourcePath] = useState('/blog/');
  const [destinationUrl, setDestinationUrl] = useState('/blog/');
  const [statusCode, setStatusCode] = useState(301);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await apiClient.get<RedirectRow[]>(`/blog/admin/redirects?channel=${channel}`);
      setRows(Array.isArray(list) ? list : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    try {
      await apiClient.post('/blog/admin/redirects', {
        channel,
        sourcePath,
        destinationUrl: statusCode === 410 ? 'gone:410' : destinationUrl,
        statusCode,
        reason: statusCode === 410 ? 'GONE' : 'MANUAL',
      });
      setSourcePath('/blog/');
      setDestinationUrl('/blog/');
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">مدیریت ریدایرکت سئو</h2>
          <p className="text-xs text-gray-500">{channelLabel(channel)} — جلوگیری از حلقه و پشتیبانی ۴۱۰</p>
        </div>
        <AdminChannelTabs value={channel} onChange={setChannel} />
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-4">
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
          dir="ltr"
          value={sourcePath}
          onChange={(e) => setSourcePath(e.target.value)}
          placeholder="/blog/old-slug"
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
          dir="ltr"
          value={destinationUrl}
          onChange={(e) => setDestinationUrl(e.target.value)}
          placeholder="/blog/new-slug"
          disabled={statusCode === 410}
        />
        <select
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs"
          value={statusCode}
          onChange={(e) => setStatusCode(Number(e.target.value))}
        >
          <option value={301}>301</option>
          <option value={302}>302</option>
          <option value={410}>410 Gone</option>
        </select>
        <button type="button" onClick={create} className="btn btn-primary btn-sm inline-flex items-center justify-center gap-1">
          <Plus className="h-3.5 w-3.5" />
          افزودن
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full min-w-[700px] text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              {['مبدأ', 'مقصد', 'کد', 'hits', ''].map((h) => (
                <th key={h} className="px-3 py-2 text-right font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  در حال بارگذاری…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  ریدایرکتی نیست
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-mono" dir="ltr">
                    {r.sourcePath}
                  </td>
                  <td className="px-3 py-2 font-mono" dir="ltr">
                    {r.destinationUrl}
                  </td>
                  <td className="px-3 py-2">{r.statusCode}</td>
                  <td className="px-3 py-2">{r.hitCount?.toLocaleString('fa-IR') || '۰'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-error"
                      onClick={async () => {
                        await apiClient.delete(`/blog/admin/redirects/${r.id}`);
                        await load();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminBlogSettingsPanel() {
  const [channel, setChannel] = useState<AdminChannel>('WHOLESALE');
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await apiClient.get<Record<string, unknown>>(`/blog/admin/settings?channel=${channel}`);
      setForm(s || {});
    } catch {
      setForm({});
    }
  }, [channel]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/blog/admin/settings?channel=${channel}`, form);
      alert('ذخیره شد');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا');
    } finally {
      setSaving(false);
    }
  };

  const bool = (key: string) => !!form[key];
  const setBool = (key: string, v: boolean) => setForm((f) => ({ ...f, [key]: v }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">تنظیمات وبلاگ — {channelLabel(channel)}</h2>
        <AdminChannelTabs value={channel} onChange={setChannel} />
      </div>
      <div className="card space-y-3 p-4">
        <input
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={String(form.blogTitle || '')}
          onChange={(e) => setForm((f) => ({ ...f, blogTitle: e.target.value }))}
          placeholder="عنوان وبلاگ"
        />
        <textarea
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          rows={3}
          value={String(form.blogDescription || '')}
          onChange={(e) => setForm((f) => ({ ...f, blogDescription: e.target.value }))}
          placeholder="توضیح وبلاگ"
        />
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          {[
            ['commentsEnabled', 'نظرات پیش‌فرض فعال'],
            ['rssEnabled', 'RSS فعال'],
            ['autoCreateRedirect', 'ریدایرکت خودکار با تغییر اسلاگ'],
            ['autoGenerateToc', 'TOC خودکار'],
            ['relatedArticlesEnabled', 'مقالات مرتبط'],
            ['relatedProductsEnabled', 'محصولات مرتبط'],
            ['showAuthor', 'نمایش نویسنده'],
            ['showReadingTime', 'نمایش زمان مطالعه'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={bool(key)} onChange={(e) => setBool(key, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
        <button type="button" disabled={saving} onClick={save} className="btn btn-primary btn-sm inline-flex items-center gap-1">
          <Save className="h-3.5 w-3.5" />
          ذخیره تنظیمات
        </button>
      </div>
    </div>
  );
}

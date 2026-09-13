'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { channelLabel } from './AdminChannelTabs';
import { useAdminBlogWorkspace } from './AdminBlogWorkspace';
import { settingsWritePayload } from '@/lib/admin-blog-workspace';

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

interface AuthorOption {
  id: string;
  displayName: string;
}

export function AdminBlogRedirects() {
  const { channel, syncEpoch, bump } = useAdminBlogWorkspace();
  const [rows, setRows] = useState<RedirectRow[]>([]);
  const [sourcePath, setSourcePath] = useState('/blog/');
  const [destinationUrl, setDestinationUrl] = useState('/blog/');
  const [statusCode, setStatusCode] = useState(301);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await apiClient.get<RedirectRow[]>(`/blog/admin/redirects?channel=${channel}`);
      setRows(Array.isArray(list) ? list : []);
      setLoadError(null);
    } catch (err: unknown) {
      setRows([]);
      setLoadError(err instanceof Error ? err.message : 'بارگذاری ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    void load();
  }, [load, syncEpoch]);

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
      bump();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">مدیریت ریدایرکت سئو</h2>
        <p className="text-xs text-gray-500">{channelLabel(channel)} — جلوگیری از حلقه و پشتیبانی ۴۱۰</p>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {loadError}
        </div>
      ) : null}

      <div className="card grid gap-3 p-4 sm:grid-cols-4">
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          dir="ltr"
          value={sourcePath}
          onChange={(e) => setSourcePath(e.target.value)}
          placeholder="/blog/old-slug"
          aria-label="مسیر مبدأ"
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          dir="ltr"
          value={destinationUrl}
          onChange={(e) => setDestinationUrl(e.target.value)}
          placeholder="/blog/new-slug"
          disabled={statusCode === 410}
          aria-label="مسیر مقصد"
        />
        <select
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs"
          value={statusCode}
          onChange={(e) => setStatusCode(Number(e.target.value))}
          aria-label="کد ریدایرکت"
        >
          <option value={301}>301</option>
          <option value={302}>302</option>
          <option value={307}>307</option>
          <option value={308}>308</option>
          <option value={410}>410 Gone</option>
        </select>
        <button type="button" onClick={() => void create()} className="btn btn-primary btn-sm inline-flex items-center justify-center gap-1">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          افزودن
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full min-w-[700px] text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              {['مبدأ', 'مقصد', 'کد', 'hits', 'فعال', ''].map((h) => (
                <th key={h} className="px-3 py-2 text-right font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  در حال بارگذاری…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  ریدایرکتی برای این کانال نیست
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
                      className="text-xs text-primary underline"
                      onClick={async () => {
                        try {
                          await apiClient.patch(`/blog/admin/redirects/${r.id}`, { isActive: !r.isActive });
                          bump();
                        } catch (e: unknown) {
                          alert(e instanceof Error ? e.message : 'خطا');
                        }
                      }}
                    >
                      {r.isActive ? 'فعال' : 'خاموش'}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-error"
                      aria-label={`حذف ریدایرکت ${r.sourcePath}`}
                      onClick={async () => {
                        if (!window.confirm('حذف این ریدایرکت؟')) return;
                        try {
                          await apiClient.delete(`/blog/admin/redirects/${r.id}`);
                          bump();
                        } catch (e: unknown) {
                          alert(e instanceof Error ? e.message : 'حذف ناموفق');
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
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
  const { channel, syncEpoch, bump } = useAdminBlogWorkspace();
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [authors, setAuthors] = useState<AuthorOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, list] = await Promise.all([
        apiClient.get<Record<string, unknown>>(`/blog/admin/settings?channel=${channel}`),
        apiClient.get<AuthorOption[]>('/blog/admin/authors').catch(() => []),
      ]);
      setForm(s || {});
      setAuthors(Array.isArray(list) ? list : []);
      setLoadError(null);
    } catch (err: unknown) {
      setForm({});
      setLoadError(err instanceof Error ? err.message : 'بارگذاری ناموفق بود');
    }
  }, [channel]);

  useEffect(() => {
    void load();
  }, [load, syncEpoch]);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/blog/admin/settings?channel=${channel}`, settingsWritePayload(form));
      bump();
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
      <h2 className="text-lg font-bold">تنظیمات وبلاگ — {channelLabel(channel)}</h2>
      {loadError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {loadError}
        </p>
      ) : null}
      <div className="card space-y-3 p-4">
        <input
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          value={String(form.blogTitle || '')}
          onChange={(e) => setForm((f) => ({ ...f, blogTitle: e.target.value }))}
          placeholder="عنوان وبلاگ"
          aria-label="عنوان وبلاگ"
        />
        <textarea
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          rows={3}
          value={String(form.blogDescription || '')}
          onChange={(e) => setForm((f) => ({ ...f, blogDescription: e.target.value }))}
          placeholder="توضیح وبلاگ"
          aria-label="توضیح وبلاگ"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-gray-600">
            مقالات در هر صفحه
            <input
              type="number"
              min={4}
              max={24}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={Number(form.articlesPerPage || 12)}
              onChange={(e) => setForm((f) => ({ ...f, articlesPerPage: Number(e.target.value) || 12 }))}
            />
          </label>
          <label className="text-xs text-gray-600">
            نویسنده پیش‌فرض
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={String(form.defaultAuthorId || '')}
              onChange={(e) => setForm((f) => ({ ...f, defaultAuthorId: e.target.value || null }))}
            >
              <option value="">—</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600 sm:col-span-2">
            تصویر OG پیش‌فرض
            <input
              dir="ltr"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
              value={String(form.defaultOgImage || '')}
              onChange={(e) => setForm((f) => ({ ...f, defaultOgImage: e.target.value || null }))}
              placeholder="https://…"
            />
          </label>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {(
            [
              ['commentsEnabled', 'نظرات پیش‌فرض فعال'],
              ['rssEnabled', 'RSS فعال'],
              ['autoCreateRedirect', 'ریدایرکت خودکار با تغییر اسلاگ'],
              ['autoGenerateToc', 'TOC خودکار'],
              ['autoGenerateSlug', 'اسلاگ خودکار'],
              ['autoGenerateReadingTime', 'زمان مطالعه خودکار'],
              ['relatedArticlesEnabled', 'مقالات مرتبط'],
              ['relatedProductsEnabled', 'محصولات مرتبط'],
              ['showAuthor', 'نمایش نویسنده'],
              ['showPublishDate', 'نمایش تاریخ انتشار'],
              ['showReadingTime', 'نمایش زمان مطالعه'],
              ['defaultRobotsIndex', 'ایندکس پیش‌فرض'],
              ['defaultRobotsFollow', 'فالو پیش‌فرض'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={bool(key)} onChange={(e) => setBool(key, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="btn btn-primary btn-sm inline-flex items-center gap-1"
        >
          <Save className="h-3.5 w-3.5" aria-hidden />
          ذخیره تنظیمات این کانال
        </button>
      </div>
    </div>
  );
}

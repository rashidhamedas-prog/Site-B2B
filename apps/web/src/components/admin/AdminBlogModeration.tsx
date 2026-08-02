'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, X, Ban, Plus, Save } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { AdminChannelTabs, type AdminChannel } from './AdminChannelTabs';

interface PendingComment {
  id: string;
  articleId: string;
  name: string;
  content: string;
  createdAt: string;
  articleTitle?: string;
  articleSlug?: string;
  channel?: string;
}

interface Author {
  id: string;
  displayName: string;
  slug: string;
  bio: string;
  jobTitle?: string | null;
  authorPageEnabled?: boolean;
  robotsIndex?: boolean;
}

export function AdminBlogCommentsPanel() {
  const [channel, setChannel] = useState<AdminChannel>('WHOLESALE');
  const [rows, setRows] = useState<PendingComment[]>([]);

  const load = useCallback(async () => {
    try {
      const list = await apiClient.get<PendingComment[]>(
        `/blog/admin/comments/pending?channel=${channel}`,
      );
      setRows(Array.isArray(list) ? list : []);
    } catch {
      setRows([]);
    }
  }, [channel]);

  useEffect(() => {
    load();
  }, [load]);

  const moderate = async (id: string, status: 'APPROVED' | 'REJECTED' | 'SPAM') => {
    await apiClient.patch(`/blog/admin/comments/${id}`, { status });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">نظرات در انتظار تأیید</h2>
        <AdminChannelTabs value={channel} onChange={setChannel} />
      </div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="card p-6 text-center text-sm text-gray-400">نظری در صف نیست.</p>
        ) : (
          rows.map((c) => (
            <div key={c.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="mt-1 text-xs text-gray-500">{c.articleTitle || c.articleSlug}</p>
                <p className="mt-2 text-sm text-gray-700">{c.content}</p>
              </div>
              <div className="flex gap-1">
                <button type="button" className="btn btn-outline btn-sm text-green-700" onClick={() => moderate(c.id, 'APPROVED')} title="تأیید">
                  <Check className="h-4 w-4" />
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => moderate(c.id, 'REJECTED')} title="رد">
                  <X className="h-4 w-4" />
                </button>
                <button type="button" className="btn btn-outline btn-sm text-error" onClick={() => moderate(c.id, 'SPAM')} title="اسپم">
                  <Ban className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function AdminBlogAuthorsPanel() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [form, setForm] = useState({ displayName: '', slug: '', bio: '', jobTitle: '' });

  const load = useCallback(async () => {
    try {
      const list = await apiClient.get<Author[]>('/blog/admin/authors');
      setAuthors(Array.isArray(list) ? list : []);
    } catch {
      setAuthors([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!form.displayName.trim()) return;
    try {
      await apiClient.post('/blog/admin/authors', form);
      setForm({ displayName: '', slug: '', bio: '', jobTitle: '' });
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">نویسندگان</h2>
      <div className="card grid gap-2 p-4 sm:grid-cols-2">
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="نام نمایشی *"
          value={form.displayName}
          onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm"
          dir="ltr"
          placeholder="slug"
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="سمت"
          value={form.jobTitle}
          onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
        />
        <textarea
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm sm:col-span-2"
          rows={2}
          placeholder="بیو"
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
        />
        <button type="button" onClick={create} className="btn btn-primary btn-sm inline-flex items-center gap-1 sm:col-span-2 sm:w-fit">
          <Plus className="h-3.5 w-3.5" />
          افزودن نویسنده
        </button>
      </div>
      <div className="space-y-2">
        {authors.map((a) => (
          <div key={a.id} className="card flex items-center justify-between gap-3 p-3 text-sm">
            <div>
              <p className="font-semibold">{a.displayName}</p>
              <p className="font-mono text-[11px] text-gray-400" dir="ltr">
                /blog/author/{a.slug}
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-error"
              onClick={async () => {
                await apiClient.delete(`/blog/admin/authors/${a.id}`);
                await load();
              }}
            >
              حذف
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

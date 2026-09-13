'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, Check, Pencil, Plus, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { channelLabel } from './AdminChannelTabs';
import { useAdminBlogWorkspace } from './AdminBlogWorkspace';

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
  avatarUrl?: string | null;
  expertise?: string[] | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
  authorPageEnabled?: boolean;
  robotsIndex?: boolean;
}

const emptyAuthor = {
  displayName: '',
  slug: '',
  bio: '',
  jobTitle: '',
  avatarUrl: '',
  expertise: '',
  instagramUrl: '',
  linkedinUrl: '',
  websiteUrl: '',
  authorPageEnabled: true,
  robotsIndex: true,
};

const ROLE_FA: Record<string, string> = {
  SUPER_ADMIN: 'مدیر کل وبلاگ',
  SEO_MANAGER: 'مدیر سئو',
  CONTENT_MANAGER: 'مدیر محتوا',
  EDITOR: 'ویراستار',
  AUTHOR: 'نویسنده',
  REVIEWER: 'بازبین',
  VIEWER: 'مشاهده‌گر',
};

export function AdminBlogCommentsPanel() {
  const { channel, syncEpoch, bump } = useAdminBlogWorkspace();
  const [rows, setRows] = useState<PendingComment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await apiClient.get<PendingComment[]>(`/blog/admin/comments/pending?channel=${channel}`);
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

  const moderate = async (id: string, status: 'APPROVED' | 'REJECTED' | 'SPAM') => {
    try {
      await apiClient.patch(`/blog/admin/comments/${id}`, { status });
      bump();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">نظرات در انتظار تأیید — {channelLabel(channel)}</h2>
      {loadError ? (
        <div className="card flex items-center justify-between border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-800">{loadError}</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
            تلاش مجدد
          </button>
        </div>
      ) : null}
      <div className="space-y-2">
        {loading ? (
          <p className="card p-6 text-center text-sm text-gray-400">در حال بارگذاری…</p>
        ) : rows.length === 0 ? (
          <p className="card p-6 text-center text-sm text-gray-400">نظری در صف این کانال نیست.</p>
        ) : (
          rows.map((c) => (
            <div key={c.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {c.articleTitle || c.articleSlug} — {new Date(c.createdAt).toLocaleString('fa-IR')}
                </p>
                <p className="mt-2 text-sm text-gray-700">{c.content}</p>
              </div>
              <div className="flex gap-1">
                <button type="button" className="btn btn-outline btn-sm text-green-700" onClick={() => void moderate(c.id, 'APPROVED')} aria-label="تأیید نظر">
                  <Check className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void moderate(c.id, 'REJECTED')} aria-label="رد نظر">
                  <X className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" className="btn btn-outline btn-sm text-error" onClick={() => void moderate(c.id, 'SPAM')} aria-label="اسپم">
                  <Ban className="h-4 w-4" aria-hidden />
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
  const { bump, syncEpoch } = useAdminBlogWorkspace();
  const [authors, setAuthors] = useState<Author[]>([]);
  const [form, setForm] = useState(emptyAuthor);
  const [editId, setEditId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await apiClient.get<Author[]>('/blog/admin/authors');
      setAuthors(Array.isArray(list) ? list : []);
      setLoadError(null);
    } catch (err: unknown) {
      setAuthors([]);
      setLoadError(err instanceof Error ? err.message : 'بارگذاری ناموفق بود');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, syncEpoch]);

  const save = async () => {
    if (!form.displayName.trim()) return;
    const payload = {
      displayName: form.displayName.trim(),
      slug: form.slug || undefined,
      bio: form.bio,
      jobTitle: form.jobTitle || undefined,
      avatarUrl: form.avatarUrl || undefined,
      expertise: form.expertise
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      instagramUrl: form.instagramUrl || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      websiteUrl: form.websiteUrl || undefined,
      authorPageEnabled: form.authorPageEnabled,
      robotsIndex: form.robotsIndex,
    };
    try {
      if (editId) await apiClient.put(`/blog/admin/authors/${editId}`, payload);
      else await apiClient.post('/blog/admin/authors', payload);
      setForm(emptyAuthor);
      setEditId(null);
      bump();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">{editId ? 'ویرایش نویسنده' : 'نویسندگان'}</h2>
        <p className="text-xs text-gray-500">
          نویسنده‌ها مشترک هر دو سایت‌اند؛ صفحه عمومی نویسنده با کانال فیلتر می‌شود.
        </p>
      </div>
      {loadError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {loadError}
        </p>
      ) : null}
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
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
          dir="ltr"
          placeholder="آدرس تصویر پروفایل"
          value={form.avatarUrl}
          onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm sm:col-span-2"
          placeholder="تخصص‌ها (با ویرگول)"
          value={form.expertise}
          onChange={(e) => setForm((f) => ({ ...f, expertise: e.target.value }))}
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
          dir="ltr"
          placeholder="instagram"
          value={form.instagramUrl}
          onChange={(e) => setForm((f) => ({ ...f, instagramUrl: e.target.value }))}
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
          dir="ltr"
          placeholder="linkedin"
          value={form.linkedinUrl}
          onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs sm:col-span-2"
          dir="ltr"
          placeholder="website"
          value={form.websiteUrl}
          onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
        />
        <textarea
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm sm:col-span-2"
          rows={2}
          placeholder="بیو"
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
        />
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.authorPageEnabled}
            onChange={(e) => setForm((f) => ({ ...f, authorPageEnabled: e.target.checked }))}
          />
          صفحه نویسنده فعال
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.robotsIndex}
            onChange={(e) => setForm((f) => ({ ...f, robotsIndex: e.target.checked }))}
          />
          ایندکس صفحه نویسنده
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button type="button" onClick={() => void save()} className="btn btn-primary btn-sm inline-flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {editId ? 'ذخیره نویسنده' : 'افزودن نویسنده'}
          </button>
          {editId ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setEditId(null);
                setForm(emptyAuthor);
              }}
            >
              انصراف
            </button>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        {authors.map((a) => (
          <div key={a.id} className="card flex items-center justify-between gap-3 p-3 text-sm">
            <div className="min-w-0">
              <p className="font-semibold">{a.displayName}</p>
              <p className="font-mono text-[11px] text-gray-400" dir="ltr">
                /blog/author/{a.slug}
              </p>
              {a.jobTitle ? <p className="text-xs text-gray-500">{a.jobTitle}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-gray-400 hover:text-primary"
                aria-label={`ویرایش ${a.displayName}`}
                onClick={() => {
                  setEditId(a.id);
                  setForm({
                    displayName: a.displayName,
                    slug: a.slug,
                    bio: a.bio || '',
                    jobTitle: a.jobTitle || '',
                    avatarUrl: a.avatarUrl || '',
                    expertise: (a.expertise || []).join(', '),
                    instagramUrl: a.instagramUrl || '',
                    linkedinUrl: a.linkedinUrl || '',
                    websiteUrl: a.websiteUrl || '',
                    authorPageEnabled: a.authorPageEnabled !== false,
                    robotsIndex: a.robotsIndex !== false,
                  });
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                className="text-xs text-error"
                onClick={async () => {
                  if (!window.confirm(`حذف نویسنده «${a.displayName}»؟`)) return;
                  try {
                    await apiClient.delete(`/blog/admin/authors/${a.id}`);
                    bump();
                  } catch (e: unknown) {
                    alert(e instanceof Error ? e.message : 'حذف ناموفق');
                  }
                }}
              >
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminBlogRolesPanel() {
  const [roles, setRoles] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void apiClient
      .get<{ roles?: string[] }>('/blog/admin/roles')
      .then((res) => setRoles(Array.isArray(res?.roles) ? res.roles : []))
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : 'بارگذاری ناموفق بود'));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">نقش‌های وبلاگ</h2>
        <p className="text-xs text-gray-500">
          ادمین بدون blogRole معادل SUPER_ADMIN است. تخصیص نقش از API{' '}
          <span className="font-mono" dir="ltr">
            PATCH /v1/blog/admin/users/:id/blog-role
          </span>
        </p>
      </div>
      {loadError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {loadError}
        </p>
      ) : null}
      <div className="card divide-y divide-gray-50">
        {(roles.length ? roles : Object.keys(ROLE_FA)).map((role) => (
          <div key={role} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="font-semibold">{ROLE_FA[role] || role}</span>
            <span className="font-mono text-[11px] text-gray-400" dir="ltr">
              {role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

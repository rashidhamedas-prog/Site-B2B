'use client';

import { useState } from 'react';
import { AdminBlog } from './AdminBlog';
import { AdminBlogRedirects, AdminBlogSettingsPanel } from './AdminBlogSeoPanels';
import { AdminBlogCommentsPanel, AdminBlogAuthorsPanel } from './AdminBlogModeration';
import { cn } from '@/lib/cn';

const TABS = [
  { id: 'posts', label: 'مقالات' },
  { id: 'redirects', label: 'ریدایرکت' },
  { id: 'settings', label: 'تنظیمات' },
  { id: 'comments', label: 'نظرات' },
  { id: 'authors', label: 'نویسندگان' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AdminBlogHub() {
  const [tab, setTab] = useState<TabId>('posts');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium',
              tab === t.id ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'posts' && <AdminBlog />}
      {tab === 'redirects' && <AdminBlogRedirects />}
      {tab === 'settings' && <AdminBlogSettingsPanel />}
      {tab === 'comments' && <AdminBlogCommentsPanel />}
      {tab === 'authors' && <AdminBlogAuthorsPanel />}
    </div>
  );
}

'use client';

import { Suspense } from 'react';
import { AdminBlog } from './AdminBlog';
import { AdminBlogRedirects, AdminBlogSettingsPanel } from './AdminBlogSeoPanels';
import { AdminBlogCommentsPanel, AdminBlogAuthorsPanel, AdminBlogRolesPanel } from './AdminBlogModeration';
import { AdminBlogAnalyticsPanel } from './AdminBlogAnalytics';
import { AdminBlogTaxonomy } from './AdminBlogTaxonomy';
import { AdminBlogWorkspaceProvider, useAdminBlogWorkspace } from './AdminBlogWorkspace';
import { AdminChannelTabs } from './AdminChannelTabs';
import { BLOG_HUB_TABS, BLOG_HUB_TAB_LABEL, channelPublicHost } from '@/lib/admin-blog-workspace';
import { cn } from '@/lib/cn';

function AdminBlogHubInner() {
  const { channel, tab, setChannel, setTab } = useAdminBlogWorkspace();
  const host = channelPublicHost(channel);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">وبلاگ و سئو</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            همه تب‌ها روی همین کانال هم‌گام‌اند —{' '}
            <span className="font-mono text-xs" dir="ltr">
              {host}
            </span>
          </p>
        </div>
        <AdminChannelTabs value={channel} onChange={setChannel} />
      </div>

      <div
        className="flex gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1"
        role="tablist"
        aria-label="بخش‌های وبلاگ"
      >
        {BLOG_HUB_TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              tab === id ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            {BLOG_HUB_TAB_LABEL[id]}
          </button>
        ))}
      </div>

      {tab === 'posts' && <AdminBlog />}
      {tab === 'taxonomy' && <AdminBlogTaxonomy />}
      {tab === 'redirects' && <AdminBlogRedirects />}
      {tab === 'settings' && <AdminBlogSettingsPanel />}
      {tab === 'comments' && <AdminBlogCommentsPanel />}
      {tab === 'authors' && <AdminBlogAuthorsPanel />}
      {tab === 'analytics' && <AdminBlogAnalyticsPanel />}
      {tab === 'roles' && <AdminBlogRolesPanel />}
    </div>
  );
}

export function AdminBlogHub() {
  return (
    <Suspense
      fallback={<div className="rounded-xl border border-gray-100 bg-white p-8 text-sm text-gray-400">در حال بارگذاری وبلاگ…</div>}
    >
      <AdminBlogWorkspaceProvider>
        <AdminBlogHubInner />
      </AdminBlogWorkspaceProvider>
    </Suspense>
  );
}

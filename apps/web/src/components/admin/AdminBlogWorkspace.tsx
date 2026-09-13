'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { AdminChannel } from './AdminChannelTabs';
import {
  parseBlogWorkspaceQuery,
  serializeBlogWorkspaceQuery,
  type BlogHubTab,
} from '@/lib/admin-blog-workspace';

interface AdminBlogWorkspaceValue {
  channel: AdminChannel;
  tab: BlogHubTab;
  syncEpoch: number;
  setChannel: (channel: AdminChannel) => void;
  setTab: (tab: BlogHubTab) => void;
  bump: () => void;
}

const AdminBlogWorkspaceContext = createContext<AdminBlogWorkspaceValue | null>(null);

export function AdminBlogWorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parsed = parseBlogWorkspaceQuery(searchParams);
  const [syncEpoch, setSyncEpoch] = useState(0);

  const replaceQuery = useCallback(
    (next: { channel: AdminChannel; tab: BlogHubTab }) => {
      const qs = serializeBlogWorkspaceQuery(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const value = useMemo<AdminBlogWorkspaceValue>(
    () => ({
      channel: parsed.channel,
      tab: parsed.tab,
      syncEpoch,
      setChannel: (channel) => replaceQuery({ channel, tab: parsed.tab }),
      setTab: (tab) => replaceQuery({ channel: parsed.channel, tab }),
      bump: () => setSyncEpoch((n) => n + 1),
    }),
    [parsed.channel, parsed.tab, replaceQuery, syncEpoch],
  );

  return (
    <AdminBlogWorkspaceContext.Provider value={value}>{children}</AdminBlogWorkspaceContext.Provider>
  );
}

export function useAdminBlogWorkspace() {
  const ctx = useContext(AdminBlogWorkspaceContext);
  if (!ctx) {
    throw new Error('useAdminBlogWorkspace must be used inside AdminBlogWorkspaceProvider');
  }
  return ctx;
}

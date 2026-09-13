import type { AdminChannel } from '@/components/admin/AdminChannelTabs';

export const BLOG_HUB_TABS = [
  'posts',
  'taxonomy',
  'redirects',
  'settings',
  'comments',
  'authors',
  'analytics',
  'roles',
] as const;

export type BlogHubTab = (typeof BLOG_HUB_TABS)[number];

export const BLOG_HUB_TAB_LABEL: Record<BlogHubTab, string> = {
  posts: 'مقالات',
  taxonomy: 'دسته/تگ',
  redirects: 'ریدایرکت',
  settings: 'تنظیمات',
  comments: 'نظرات',
  authors: 'نویسندگان',
  analytics: 'آمار',
  roles: 'نقش‌ها',
};

const CHANNELS: readonly AdminChannel[] = ['WHOLESALE', 'RETAIL'];

export function isAdminChannel(value: unknown): value is AdminChannel {
  return value === 'WHOLESALE' || value === 'RETAIL';
}

export function isBlogHubTab(value: unknown): value is BlogHubTab {
  return typeof value === 'string' && (BLOG_HUB_TABS as readonly string[]).includes(value);
}

export function parseBlogWorkspaceQuery(search: {
  get(name: string): string | null;
}): { channel: AdminChannel; tab: BlogHubTab } {
  const rawChannel = (search.get('channel') || '').toUpperCase();
  const rawTab = (search.get('tab') || '').toLowerCase();
  return {
    channel: isAdminChannel(rawChannel) ? rawChannel : 'WHOLESALE',
    tab: isBlogHubTab(rawTab) ? rawTab : 'posts',
  };
}

export function serializeBlogWorkspaceQuery(input: {
  channel: AdminChannel;
  tab: BlogHubTab;
}): string {
  const q = new URLSearchParams();
  if (input.channel !== 'WHOLESALE') q.set('channel', input.channel);
  if (input.tab !== 'posts') q.set('tab', input.tab);
  return q.toString();
}

const SETTINGS_STRIP = new Set(['id', 'createdAt', 'updatedAt', 'channel']);

/** Keep channel in the query string; never overwrite the other site's row id. */
export function settingsWritePayload(form: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(form)) {
    if (SETTINGS_STRIP.has(key)) continue;
    next[key] = value;
  }
  return next;
}

export function channelPublicHost(channel: AdminChannel): string {
  return channel === 'RETAIL' ? 'poshaktaranom.ir' : 'poshaktaranom.com';
}

export { CHANNELS as BLOG_WORKSPACE_CHANNELS };

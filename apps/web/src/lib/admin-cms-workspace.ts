import { CMS_PAGE_KEYS_BASE, CMS_WHOLESALE_ONLY } from './cms/page-keys';

export type AdminChannel = 'WHOLESALE' | 'RETAIL';

export type CmsWorkspacePage = string;

const CHANNELS: readonly AdminChannel[] = ['WHOLESALE', 'RETAIL'];

export function isAdminChannel(value: unknown): value is AdminChannel {
  return value === 'WHOLESALE' || value === 'RETAIL';
}

export function cmsPageKeysForChannel(channel: AdminChannel): ReadonlyArray<{ key: string; label: string }> {
  return channel === 'WHOLESALE' ? [...CMS_PAGE_KEYS_BASE, CMS_WHOLESALE_ONLY] : [...CMS_PAGE_KEYS_BASE];
}

export function isCmsWorkspacePage(channel: AdminChannel, value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  return cmsPageKeysForChannel(channel).some((p) => p.key === value);
}

export function parseCmsWorkspaceQuery(search: {
  get(name: string): string | null;
}): { channel: AdminChannel; page: string } {
  const rawChannel = (search.get('channel') || '').toUpperCase();
  const channel = isAdminChannel(rawChannel) ? rawChannel : 'WHOLESALE';
  const rawPage = (search.get('page') || '').trim();
  return {
    channel,
    page: isCmsWorkspacePage(channel, rawPage) ? rawPage : 'home',
  };
}

export function serializeCmsWorkspaceQuery(input: { channel: AdminChannel; page: string }): string {
  const q = new URLSearchParams();
  if (input.channel !== 'WHOLESALE') q.set('channel', input.channel);
  if (input.page && input.page !== 'home') q.set('page', input.page);
  return q.toString();
}

export function channelPublicHost(channel: AdminChannel): string {
  return channel === 'RETAIL' ? 'poshaktaranom.ir' : 'poshaktaranom.com';
}

export function cmsPageLabel(channel: AdminChannel, page: string): string {
  return cmsPageKeysForChannel(channel).find((p) => p.key === page)?.label ?? page;
}

export { CHANNELS as CMS_WORKSPACE_CHANNELS };

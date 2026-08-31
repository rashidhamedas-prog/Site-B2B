export type PublicationSyncAction = 'create' | 'update' | 'refresh' | 'reopen' | 'withdraw' | 'skip';

/** Decide local publication row mutation. Never implies a remote delivery. */
export function nextPublicationAction(
  existing: { status: string } | null,
  publishable: boolean,
): PublicationSyncAction {
  if (!publishable) {
    if (existing && existing.status !== 'WITHDRAWN' && existing.status !== 'FAILED') return 'withdraw';
    return 'skip';
  }
  if (!existing) return 'create';
  if (existing.status === 'WITHDRAWN') return 'reopen';
  if (existing.status === 'READY' || existing.status === 'PUBLISHED' || existing.status === 'PARTIAL' || existing.status === 'FAILED') {
    return 'refresh';
  }
  return 'update';
}

export function syncChannelsForEvent(channel?: string | null): Array<'RETAIL' | 'WHOLESALE'> {
  const raw = String(channel || '').toUpperCase();
  if (raw === 'RETAIL' || raw === 'WHOLESALE') return [raw];
  return ['RETAIL', 'WHOLESALE'];
}

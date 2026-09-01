export type PublicationSyncAction = 'create' | 'update' | 'refresh' | 'reopen' | 'withdraw' | 'skip';
export type OosLocalAction = 'refresh' | 'skip_create' | 'withdraw_local';

/** Visibility first; stock-only OOS never creates a delivery. */
export function applyOosLocalAction(
  visibilityAction: PublicationSyncAction,
  local: OosLocalAction,
): PublicationSyncAction {
  if (visibilityAction === 'withdraw' || visibilityAction === 'skip') return visibilityAction;
  if (local === 'skip_create') {
    return visibilityAction === 'create' || visibilityAction === 'reopen' ? 'skip' : visibilityAction;
  }
  if (local === 'withdraw_local') return 'withdraw';
  return visibilityAction;
}

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

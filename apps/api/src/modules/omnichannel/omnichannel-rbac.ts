/**
 * Omnichannel Viewer / Publisher / Owner matrix (PR-6).
 * Independent of staff `users.role` (ADMIN). Flag-gated: default off = every ADMIN is full access.
 */

export const OMNICHANNEL_ROLES = ['VIEWER', 'PUBLISHER', 'OWNER'] as const;
export type OmnichannelRole = (typeof OMNICHANNEL_ROLES)[number];

export const OMNICHANNEL_AUDIT_SOURCES = ['panel', 'out_of_panel'] as const;
export type OmnichannelAuditSource = (typeof OMNICHANNEL_AUDIT_SOURCES)[number];

const ROLE_RANK: Record<OmnichannelRole, number> = {
  VIEWER: 1,
  PUBLISHER: 2,
  OWNER: 3,
};

export function isOmnichannelRbacEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OMNICHANNEL_RBAC_ENABLED === 'true';
}

export function parseOwnerUserIds(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return new Set(
    String(env.OMNICHANNEL_OWNER_USER_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function isOmnichannelRole(value: unknown): value is OmnichannelRole {
  return typeof value === 'string' && (OMNICHANNEL_ROLES as readonly string[]).includes(value);
}

/**
 * D-1: column null → OWNER when flag off; when flag on → PUBLISHER unless allowlist → OWNER.
 * Explicit column VIEWER|PUBLISHER|OWNER always wins (allowlist only elevates null).
 */
export function resolveOmnichannelRole(input: {
  /** Preferred */
  userId?: string;
  /** Alias used by OmnichannelAdminGuard */
  id?: string;
  columnRole?: string | null;
  /** Alias for users.omnichannelRole column */
  omnichannelRole?: string | null;
  env?: NodeJS.ProcessEnv;
}): OmnichannelRole {
  const env = input.env || process.env;
  if (!isOmnichannelRbacEnabled(env)) return 'OWNER';
  const column = input.columnRole ?? input.omnichannelRole;
  if (isOmnichannelRole(column)) return column;
  const userId = String(input.userId || input.id || '').trim();
  if (parseOwnerUserIds(env).has(userId)) return 'OWNER';
  return 'PUBLISHER';
}

export function roleMeetsMinimum(actual: OmnichannelRole, minimum: OmnichannelRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[minimum];
}

/** Owner-tier actions that require a non-empty goRef when RBAC is on. */
export const GO_REF_REQUIRED_ACTIONS = [
  'publications_withdraw',
  'publications_bulk_withdraw',
  'publications_requeue_by_category_live',
  'settings_patch',
  'destination_publish_settings_patch',
  'connection_publish_settings_patch',
  'secret_put',
  'secret_clear',
  'connection_delete',
  'destination_delete',
  'outbox_clear_waiting',
  'outbox_revive_connector_disabled',
  'reconcile',
  'connection_create',
  'destination_create',
  'coverage_out_of_panel_ingest',
  /** Policy-tier channel-settings only (content drafts do not need goRef). */
  'channel_settings_policy_patch',
  'channel_settings_copy_from',
  'template_activate',
  'destination_emergency_hold',
  'order_bot_enable',
  'test_owner_chat',
] as const;

export type GoRefRequiredAction = (typeof GO_REF_REQUIRED_ACTIONS)[number];

export function actionRequiresGoRef(action: string): boolean {
  return (GO_REF_REQUIRED_ACTIONS as readonly string[]).includes(action);
}

/** Persian 400 when Owner-tier lacks goRef (distinct from 403 role denial). */
export const GO_REF_REQUIRED_MESSAGE =
  'برای این عملیات Owner باید شناسه تأیید کتبی (goRef) را ارسال کنید';

export function normalizeGoRef(value: unknown): string {
  return String(value ?? '').trim();
}

export function assertGoRefPresent(goRef: unknown): string {
  const normalized = normalizeGoRef(goRef);
  if (!normalized) {
    const err = new Error(GO_REF_REQUIRED_MESSAGE);
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  return normalized;
}

/** Safe redaction for listAudits payload summaries — ids/counts only. */
export function redactAuditPayloadSummary(
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  const out: Record<string, unknown> = {};
  const allow = [
    'provider',
    'secretRef',
    'source',
    'vaultSource',
    'fingerprint',
    'rotated',
    'liveCheck',
    'hadVault',
    'stillConfigured',
    'name',
    'destinationsRemoved',
    'destinationKey',
    'displayName',
    'hadDeliveries',
    'destinationId',
    'destinationIds',
    'categoryId',
    'matched',
    'queued',
    'skipped',
    'errors',
    'hasMore',
    'cancelledEvents',
    'cancelledPending',
    'cancelledStale',
    'cancelledDeliveries',
    'revivedEvents',
    'revivedDeliveries',
    'superseded',
    'limit',
    'bulk',
    'retrySlaChosen',
    'outboxRetentionChosen',
    'remoteDeletes',
    'before',
    'after',
    'ingestHash',
    'providerMessageId',
    'action',
    'occurredAt',
    'productId',
  ];
  for (const key of allow) {
    if (key in payload) out[key] = payload[key];
  }
  return out;
}

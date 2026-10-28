/**
 * PR-7 delete/edit gates. Owner+goRef full matrix lands with PR-6 (#129);
 * until then we enforce goRef when OMNICHANNEL_RBAC_ENABLED=true and honor
 * actor.omnichannelRole when the PR-6 guard attaches it.
 *
 * Throws plain Error with statusCode so unit specs need no Nest runtime.
 */

export const GO_REF_REQUIRED_MESSAGE =
  'برای این عملیات Owner باید شناسه تأیید کتبی (goRef) را ارسال کنید';

export const DELETE_EDIT_DISABLED_MESSAGE =
  'حذف/ویرایش پیام کانال فعلاً غیرفعال است (OMNICHANNEL_DELETE_EDIT_ENABLED)';

export type DeleteEditActor = {
  id: string;
  /** Present after PR-6 OmnichannelAdminGuard / role guard. */
  omnichannelRole?: string | null;
};

function httpError(statusCode: number, message: string): Error {
  const err = new Error(message);
  (err as Error & { statusCode?: number; status?: number }).statusCode = statusCode;
  (err as Error & { statusCode?: number; status?: number }).status = statusCode;
  return err;
}

export function isOmnichannelRbacEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OMNICHANNEL_RBAC_ENABLED === 'true';
}

/** Default safe: feature off until owner canary. Explicit `true` enables mutating routes. */
export function isOmnichannelDeleteEditEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OMNICHANNEL_DELETE_EDIT_ENABLED === 'true';
}

export function normalizeGoRef(value: unknown): string {
  return String(value ?? '').trim();
}

export function assertGoRefPresent(goRef: unknown): string {
  const normalized = normalizeGoRef(goRef);
  if (!normalized) {
    throw httpError(400, GO_REF_REQUIRED_MESSAGE);
  }
  return normalized;
}

export function assertDeleteEditEnabled(env: NodeJS.ProcessEnv = process.env): void {
  if (!isOmnichannelDeleteEditEnabled(env)) {
    throw httpError(503, DELETE_EDIT_DISABLED_MESSAGE);
  }
}

function parseOwnerUserIds(env: NodeJS.ProcessEnv): Set<string> {
  return new Set(
    String(env.OMNICHANNEL_OWNER_USER_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

/**
 * Delete / withdraw live remote: OWNER + goRef when RBAC on.
 * If role is missing (pre-PR-6), goRef alone is required — role 403 waits on #129.
 */
export function assertOwnerGoRefForDelete(
  actor: DeleteEditActor,
  goRef: unknown,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!isOmnichannelRbacEnabled(env)) {
    return normalizeGoRef(goRef);
  }
  const role = String(actor.omnichannelRole || '').toUpperCase();
  if (role === 'VIEWER' || role === 'PUBLISHER') {
    throw httpError(403, 'حذف پیام کانال فقط برای نقش Owner مجاز است');
  }
  if (role && role !== 'OWNER' && !parseOwnerUserIds(env).has(actor.id)) {
    throw httpError(403, 'حذف پیام کانال فقط برای نقش Owner مجاز است');
  }
  return assertGoRefPresent(goRef);
}

/** Edit / revert: PUBLISHER+ when role known; Viewer → 403. */
export function assertPublisherForEdit(actor: DeleteEditActor, env: NodeJS.ProcessEnv = process.env): void {
  if (!isOmnichannelRbacEnabled(env)) return;
  const role = String(actor.omnichannelRole || '').toUpperCase();
  if (role === 'VIEWER') {
    throw httpError(403, 'ویرایش پیام کانال برای نقش Viewer مجاز نیست');
  }
}

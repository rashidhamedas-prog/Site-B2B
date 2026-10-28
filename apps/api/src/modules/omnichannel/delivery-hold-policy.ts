/**
 * PR-4 — no auto-revive / HOLD on unknown (stage2-design §5.2).
 *
 * Reviving DEAD `connector is disabled` deliveries is a human, one-at-a-time action.
 * `OMNICHANNEL_BULK_REVIVE_ENABLED=true` restores the legacy batch behaviour (rollback only).
 */

/** Default and only limit while the bulk flag is off. */
export const REVIVE_SINGLE_LIMIT = 1;
/** Legacy batch bounds, honoured only when the rollback flag is on. */
export const REVIVE_BULK_DEFAULT = 200;
export const REVIVE_BULK_MAX = 500;

export function isBulkReviveEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OMNICHANNEL_BULK_REVIVE_ENABLED === 'true';
}

/** Clamp the requested revive size. Flag off → always exactly one row, whatever the client sends. */
export function effectiveReviveLimit(
  requested: unknown,
  env: NodeJS.ProcessEnv = process.env,
): number {
  if (!isBulkReviveEnabled(env)) return REVIVE_SINGLE_LIMIT;
  const n = Math.floor(Number(requested) || REVIVE_BULK_DEFAULT);
  return Math.max(1, Math.min(REVIVE_BULK_MAX, n));
}

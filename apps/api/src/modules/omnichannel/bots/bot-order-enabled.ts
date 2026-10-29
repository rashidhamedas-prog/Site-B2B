/**
 * PR-14 per-connection orderBotEnabled (default OFF).
 * Stored on connection.publishSettings.orderBotEnabled — never invent true.
 */

export function readOrderBotEnabled(publishSettings: unknown): boolean {
  if (!publishSettings || typeof publishSettings !== 'object' || Array.isArray(publishSettings)) {
    return false;
  }
  return (publishSettings as Record<string, unknown>).orderBotEnabled === true;
}

export function withOrderBotEnabled(
  previous: Record<string, unknown> | null | undefined,
  enabled: boolean,
): Record<string, unknown> {
  const next = { ...(previous || {}) };
  next.orderBotEnabled = enabled === true;
  next.seeded = true;
  return next;
}

export function readOrderBotPollCursor(publishSettings: unknown): string {
  if (!publishSettings || typeof publishSettings !== 'object' || Array.isArray(publishSettings)) {
    return '';
  }
  const raw = (publishSettings as Record<string, unknown>).orderBotPollCursor;
  return String(raw ?? '').trim().slice(0, 128);
}

export function withOrderBotPollCursor(
  previous: Record<string, unknown> | null | undefined,
  cursor: string,
): Record<string, unknown> {
  const next = { ...(previous || {}) };
  const c = String(cursor || '').trim().slice(0, 128);
  if (c) next.orderBotPollCursor = c;
  else delete next.orderBotPollCursor;
  return next;
}

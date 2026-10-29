/**
 * PR-14 pure helpers — inbound update/message idempotency keys.
 * Prefer unique (provider, providerMessageId); also support update_id.
 */

export type InboundIdempotencyKey = {
  provider: string;
  providerMessageId: string;
};

export function normalizeProvider(provider: unknown): string {
  return String(provider || '').trim().toUpperCase();
}

export function normalizeProviderMessageId(raw: unknown): string {
  return String(raw ?? '').trim().slice(0, 128);
}

/** Build unique key; empty message id → null (caller must not insert as unique). */
export function inboundIdempotencyKey(
  provider: unknown,
  providerMessageId: unknown,
): InboundIdempotencyKey | null {
  const p = normalizeProvider(provider);
  const id = normalizeProviderMessageId(providerMessageId);
  if (!p || !id) return null;
  return { provider: p, providerMessageId: id };
}

/**
 * Bale / Telegram-style update envelope → stable message id.
 * Prefer message.message_id; fall back to update_id.
 */
export function extractTelegramFamilyMessageId(update: unknown): string | null {
  if (!update || typeof update !== 'object') return null;
  const u = update as Record<string, unknown>;
  const msg = (u.message || u.edited_message || u.callback_query) as
    | Record<string, unknown>
    | undefined;
  if (msg && typeof msg === 'object') {
    const fromCb = msg.message as Record<string, unknown> | undefined;
    const mid = msg.message_id ?? fromCb?.message_id;
    if (mid != null && String(mid).trim()) return String(mid).trim();
  }
  if (u.update_id != null && String(u.update_id).trim()) {
    return `upd:${String(u.update_id).trim()}`;
  }
  return null;
}

export function extractRubikaMessageId(update: unknown): string | null {
  if (!update || typeof update !== 'object') return null;
  const u = update as Record<string, unknown>;
  const nm = u.new_message as Record<string, unknown> | undefined;
  const mid = nm?.message_id ?? u.message_id ?? u.update_id;
  if (mid != null && String(mid).trim()) return String(mid).trim();
  return null;
}

/** Duplicate when key already seen — return 200 no-op. */
export function isDuplicateInbound(
  existing: { provider?: string | null; providerMessageId?: string | null } | null | undefined,
  key: InboundIdempotencyKey,
): boolean {
  if (!existing) return false;
  return (
    normalizeProvider(existing.provider) === key.provider
    && normalizeProviderMessageId(existing.providerMessageId) === key.providerMessageId
  );
}

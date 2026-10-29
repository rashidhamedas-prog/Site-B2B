/**
 * PR-14 pure helpers — inbound update/message idempotency keys.
 * Prefer unique (provider, providerMessageId); also support update_id.
 *
 * Choice when message id missing: synthesize stable sha256-based id from
 * provider|customerChatId|update_id|textPrefix (documented). If even that
 * lacks chat+provider, return null → caller rejects with ignored missing_message_id.
 */

import { createHash } from 'crypto';

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

/**
 * Synthesize stable id when provider omitted message_id.
 * Returns null when provider or customerChatId missing (reject path).
 */
export function synthesizeInboundMessageId(input: {
  provider: string;
  customerChatId: string;
  updateId?: string | null;
  text?: string;
}): string | null {
  const provider = normalizeProvider(input.provider);
  const chat = String(input.customerChatId || '').trim();
  if (!provider || !chat) return null;
  const material = [
    provider,
    chat,
    String(input.updateId || ''),
    String(input.text || '').slice(0, 64),
  ].join('|');
  const hash = createHash('sha256').update(material).digest('hex').slice(0, 32);
  return `syn:${hash}`;
}

export function resolveInboundMessageId(input: {
  provider: string;
  customerChatId: string;
  extractedId: string | null;
  updateId?: string | null;
  text?: string;
}): InboundIdempotencyKey | null {
  const extracted = inboundIdempotencyKey(input.provider, input.extractedId);
  if (extracted) return extracted;
  const syn = synthesizeInboundMessageId({
    provider: input.provider,
    customerChatId: input.customerChatId,
    updateId: input.updateId,
    text: input.text,
  });
  return inboundIdempotencyKey(input.provider, syn);
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

export function isUniqueViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code || '')
      : '';
  return code === '23505' || /unique|duplicate/i.test(msg);
}

/**
 * Album message IDs live as a comma-separated providerMessageId on the CREATE delivery.
 * PR-7 normalizes that CSV for delete-plan / backup / delivery_messages.
 */

export function parseProviderMessageIds(providerMessageId: string | null | undefined): string[] {
  if (!providerMessageId) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(providerMessageId).split(',')) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function joinProviderMessageIds(ids: string[]): string {
  return parseProviderMessageIds(ids.join(',')).join(',');
}

/**
 * Default album policy (D-5): request must cover the full ID set; partial deletes are rejected.
 */
export function assertFullAlbumDelete(
  available: string[],
  requested: string[],
): { ok: true; messageIds: string[] } | { ok: false; error: string } {
  const avail = parseProviderMessageIds(available.join(','));
  const req = parseProviderMessageIds(requested.join(','));
  if (!avail.length) {
    return { ok: false, error: 'شناسه پیام برای این ارسال یافت نشد' };
  }
  if (!req.length) {
    return { ok: false, error: 'حداقل یک شناسه پیام لازم است' };
  }
  const availSet = new Set(avail);
  for (const id of req) {
    if (!availSet.has(id)) {
      return { ok: false, error: `شناسه پیام نامعتبر است: ${id}` };
    }
  }
  // D-5: every available id must be requested (order-insensitive; no partial album).
  if (avail.some((id) => !req.includes(id))) {
    return {
      ok: false,
      error: 'حذف جزئی آلبوم مجاز نیست؛ همهٔ شناسه‌های پیام این ارسال را انتخاب کنید',
    };
  }
  return { ok: true, messageIds: avail };
}

/** Bale remote delete window: 48 hours from sentAt. */
export const BALE_DELETE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function baleDeleteWindowExpired(sentAt: Date | string | null | undefined, now = new Date()): boolean {
  if (!sentAt) return false;
  const t = sentAt instanceof Date ? sentAt.getTime() : new Date(sentAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now.getTime() - t > BALE_DELETE_WINDOW_MS;
}

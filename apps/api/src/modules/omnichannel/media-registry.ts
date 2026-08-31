export function isMissingRelationError(err: unknown): boolean {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : '';
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return code === '42P01' || (/omnichannel_media_assets/i.test(msg) && /does not exist|relation/i.test(msg));
}

export function mediaAssetRow(input: {
  publicUrl: string;
  storageKey: string;
  altText?: string;
  ownerType?: string;
  ownerId?: string | null;
  createdBy?: string | null;
}) {
  return {
    publicUrl: String(input.publicUrl || '').trim(),
    storageKey: String(input.storageKey || '').trim(),
    altText: String(input.altText || '').trim().slice(0, 200),
    ownerType: String(input.ownerType || 'UPLOAD').toUpperCase(),
    ownerId: input.ownerId || null,
    createdBy: input.createdBy || null,
  };
}

/** Keys used to tombstone registry rows after a successful object delete. */
export function mediaAssetDeleteMatch(urls: string[], keys: string[]) {
  return {
    urls: [...new Set(urls.map((u) => String(u || '').trim()).filter(Boolean))],
    keys: [...new Set(keys.map((k) => String(k || '').trim()).filter(Boolean))],
  };
}

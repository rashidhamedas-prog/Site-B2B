import {
  INTERNAL_LINK_TARGET_TYPES,
  INTERNAL_LINK_RELS,
} from './dto/internal-link.dto';

export const MAX_INTERNAL_LINKS_PER_CHANNEL = 12;
export const ANCHOR_MIN = 1;
export const ANCHOR_MAX = 60;

export type InternalLinkInput = {
  id?: string;
  targetType?: string;
  targetId?: string | null;
  targetUrl?: string;
  anchorText?: string;
  title?: string | null;
  rel?: string;
  sortOrder?: number | string;
};

export type ResolvedLink = {
  targetType: string;
  targetId: string | null;
  targetUrl: string;
  anchorText: string;
  title: string | null;
  rel: string;
  sortOrder: number;
};

export type ValidationIssue = {
  index: number;
  reason:
    | 'invalid_target_type'
    | 'anchor_length'
    | 'missing_url'
    | 'self_link'
    | 'duplicate'
    | 'invalid_rel'
    | 'too_many'
    | 'custom_not_internal'
    | 'loop';
  anchorText?: string;
  targetUrl?: string;
};

export type InternalLinkChannel = 'RETAIL' | 'WHOLESALE';

/** Build the public URL path for a named target from its slug. */
export function buildInternalLinkUrl(
  targetType: string,
  slug: string | null,
  customUrl?: string | null,
): string | null {
  if (targetType === 'CUSTOM') {
    const u = String(customUrl || '').trim();
    return u || null;
  }
  if (!slug) return null;
  if (targetType === 'PRODUCT') return `/products/${slug}`;
  if (targetType === 'CATEGORY') return `/category/${slug}`;
  if (targetType === 'BLOG') return `/blog/${slug}`;
  return null;
}

export function normalizeRel(rel?: string): string {
  const r = String(rel || 'dofollow').toLowerCase();
  return (INTERNAL_LINK_RELS as readonly string[]).includes(r) ? r : 'dofollow';
}

/** Coerce one raw input into a normalized link, or null if structurally invalid. */
export function normalizeInternalLinkInput(raw: InternalLinkInput): ResolvedLink | null {
  const targetType = String(raw.targetType || '').toUpperCase();
  if (!(INTERNAL_LINK_TARGET_TYPES as readonly string[]).includes(targetType)) return null;
  const targetUrl = String(raw.targetUrl || '').trim();
  if (!targetUrl) return null;
  const targetId = raw.targetId ? String(raw.targetId) : null;
  return {
    targetType,
    targetId,
    targetUrl,
    anchorText: String(raw.anchorText || '').trim(),
    title: raw.title ? String(raw.title).trim().slice(0, 120) : null,
    rel: normalizeRel(raw.rel),
    sortOrder: Number(raw.sortOrder ?? 0) || 0,
  };
}

/** Composite dedup key for a link (ignores client `id`). */
export function dedupKey(link: {
  targetType: string;
  targetId: string | null;
  targetUrl: string;
}): string {
  return `${link.targetType}|${link.targetId || ''}|${link.targetUrl}`;
}

/**
 * Pure (no DB) validation of a link list: count, structure, anchor length,
 * rel, duplicates, self-link, and CUSTOM must be an internal path.
 * Returns { ok, issues }. DB-dependent checks (target exists / visible / noindex)
 * are done by the service after this.
 */
export function validateInternalLinkList(
  rawLinks: InternalLinkInput[],
  productId: string | null,
): { ok: ResolvedLink[]; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (rawLinks.length > MAX_INTERNAL_LINKS_PER_CHANNEL) {
    issues.push({ index: -1, reason: 'too_many' });
  }
  const ok: ResolvedLink[] = [];
  const seen = new Set<string>();
  rawLinks.forEach((raw, index) => {
    const normalized = normalizeInternalLinkInput(raw);
    if (!normalized) {
      issues.push({
        index,
        reason: 'invalid_target_type',
        anchorText: String(raw.anchorText || ''),
        targetUrl: String(raw.targetUrl || ''),
      });
      return;
    }
    if (
      normalized.anchorText.length < ANCHOR_MIN ||
      normalized.anchorText.length > ANCHOR_MAX
    ) {
      issues.push({ index, reason: 'anchor_length', anchorText: normalized.anchorText });
      return;
    }
    if (productId && normalized.targetType === 'PRODUCT' && normalized.targetId === productId) {
      issues.push({
        index,
        reason: 'self_link',
        anchorText: normalized.anchorText,
        targetUrl: normalized.targetUrl,
      });
      return;
    }
    if (normalized.targetType === 'CUSTOM') {
      // Must be an internal relative or same-host path, not external.
      if (!isInternalUrl(normalized.targetUrl)) {
        issues.push({
          index,
          reason: 'custom_not_internal',
          anchorText: normalized.anchorText,
          targetUrl: normalized.targetUrl,
        });
        return;
      }
    }
    const key = dedupKey(normalized);
    if (seen.has(key)) {
      issues.push({
        index,
        reason: 'duplicate',
        anchorText: normalized.anchorText,
        targetUrl: normalized.targetUrl,
      });
      return;
    }
    seen.add(key);
    ok.push(normalized);
  });
  return { ok, issues };
}

/** True for relative paths or URLs on either storefront host. */
export function isInternalUrl(url: string): boolean {
  const u = String(url || '').trim();
  if (!u) return false;
  if (u.startsWith('/')) return true;
  return /^https:\/\/(www\.)?poshaktaranom\.(ir|com)\//i.test(u);
}

/**
 * True if an absolute URL points to the OPPOSITE channel's storefront host
 * (retail = .ir, wholesale = .com). Relative paths are same-channel and
 * return false. Used to enforce channel separation for CUSTOM links.
 */
export function isUrlOnOppositeChannel(
  url: string,
  channel: InternalLinkChannel,
): boolean {
  const u = String(url || '').trim();
  if (!u || u.startsWith('/')) return false;
  const m = /^https:\/\/(?:www\.)?poshaktaranom\.(ir|com)\b/i.exec(u);
  if (!m) return false;
  const hostTld = m[1].toLowerCase();
  const oppositeTld = channel === 'RETAIL' ? 'com' : 'ir';
  return hostTld === oppositeTld;
}

/**
 * Post-resolution dedup: after URLs are re-resolved, two rows that differed
 * only by targetUrl can collapse to the same final target. Dedup by the
 * FINAL state so the DB unique index can't throw a 500 — callers surface a 400.
 */
export function dedupResolvedLinks(
  links: ResolvedLink[],
): { ok: ResolvedLink[]; duplicates: ResolvedLink[] } {
  const seen = new Set<string>();
  const ok: ResolvedLink[] = [];
  const duplicates: ResolvedLink[] = [];
  for (const link of links) {
    const key =
      link.targetType === 'CUSTOM'
        ? `CUSTOM|${link.targetUrl.trim().toLowerCase()}`
        : `${link.targetType}|${link.targetId}`;
    if (seen.has(key)) {
      duplicates.push(link);
      continue;
    }
    seen.add(key);
    ok.push(link);
  }
  return { ok, duplicates };
}

/** Strip host + query/hash to get a relative path (for loop checks). */
export function toRelativePath(url: string): string {
  const u = String(url || '').trim();
  return u.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0] || '/';
}

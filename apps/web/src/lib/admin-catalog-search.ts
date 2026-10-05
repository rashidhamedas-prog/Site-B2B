/** Committed catalog search. The live input stays local until this settles. */

export const CATALOG_SEARCH_DEBOUNCE_MS = 300;
export const CATALOG_SEARCH_MAX = 80;

/** Trim only the ends. Internal spaces stay so the next word can be typed. */
export function commitCatalogSearchDraft(raw: string): string {
  return String(raw ?? '').trim().slice(0, CATALOG_SEARCH_MAX);
}

/** `null` means the URL and the request should stay as they are. */
export function nextCatalogSearchCommit(
  draft: string,
  urlQ: string,
  composing: boolean,
): string | null {
  if (composing) return null;
  const next = commitCatalogSearchDraft(draft);
  if (next === urlQ) return null;
  return next;
}

/**
 * Keep a focused draft that is ahead of a stale URL echo.
 * An empty URL (clear, back to the full list) always wins.
 */
export function reconcileCatalogSearchDraft(
  draft: string,
  urlQ: string,
  focused: boolean,
): string {
  if (commitCatalogSearchDraft(draft) === urlQ) return draft;
  if (focused && urlQ.length > 0 && draft.startsWith(urlQ)) return draft;
  return urlQ;
}

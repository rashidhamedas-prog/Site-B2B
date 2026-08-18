export const MAX_RELATED_PRODUCTS = 5;

export interface RelatedCandidate {
  id: string;
  sku?: string | null;
  status?: string | null;
  deleted?: boolean;
  categoryId?: string | null;
  collectionId?: string | null;
  fabricType?: string | null;
  sizeType?: string | null;
  showOnRetail?: boolean | null;
  showOnWholesale?: boolean | null;
}

export function normalizeFabricKey(value?: string | null): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function scoreRelatedCandidate(source: RelatedCandidate, other: RelatedCandidate): number {
  if (!other.id || other.id === source.id) return -1;
  if (other.deleted) return -1;
  if (String(other.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') return -1;
  let score = 0;
  if (source.categoryId && other.categoryId && source.categoryId === other.categoryId) score += 100;
  const fabricA = normalizeFabricKey(source.fabricType);
  const fabricB = normalizeFabricKey(other.fabricType);
  if (fabricA && fabricB && fabricA === fabricB) score += 40;
  if (source.collectionId && other.collectionId && source.collectionId === other.collectionId) score += 20;
  if (source.sizeType && other.sizeType && source.sizeType === other.sizeType) score += 10;
  return score;
}

export function sortRelatedCandidates(source: RelatedCandidate, candidates: RelatedCandidate[]): RelatedCandidate[] {
  const best = new Map<string, { item: RelatedCandidate; score: number }>();
  for (const item of candidates) {
    const score = scoreRelatedCandidate(source, item);
    if (score < 0) continue;
    const prev = best.get(item.id);
    if (!prev || score > prev.score) best.set(item.id, { item, score });
  }
  return [...best.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const skuA = String(a.item.sku || '');
    const skuB = String(b.item.sku || '');
    if (skuA !== skuB) return skuA.localeCompare(skuB);
    return String(a.item.id).localeCompare(String(b.item.id));
  }).map((row) => row.item);
}

export function fillRelatedIds(
  sourceId: string,
  existingIds: string[],
  ranked: RelatedCandidate[],
  max = MAX_RELATED_PRODUCTS,
): { next: string[]; added: string[]; kept: string[]; shortfall: number } {
  const kept = [...new Set(existingIds.map(String).filter((id) => id && id !== sourceId))].slice(0, max);
  const next = [...kept];
  const added: string[] = [];
  for (const item of ranked) {
    if (next.length >= max) break;
    if (!item.id || item.id === sourceId) continue;
    if (next.includes(item.id)) continue;
    next.push(item.id);
    added.push(item.id);
  }
  return { next, added, kept, shortfall: Math.max(0, max - next.length) };
}

export function relatedVisibleOnChannel(
  item: RelatedCandidate,
  channel: 'RETAIL' | 'WHOLESALE',
): boolean {
  if (String(item.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') return false;
  if (channel === 'RETAIL') return item.showOnRetail !== false;
  return item.showOnWholesale !== false;
}

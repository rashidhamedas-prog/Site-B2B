import type { RetailAnalyticsItemInput } from './retail-analytics';

export type CartSnapshotReader = () => RetailAnalyticsItemInput[] | null;

let cartSnapshotReader: CartSnapshotReader | null = null;

/** Cart owners register a synchronous reader so add_to_cart can fingerprint the post-add cart. */
export function registerCartSnapshot(reader: CartSnapshotReader | null) {
  cartSnapshotReader = reader;
}

export function readRegisteredCartSnapshot(): RetailAnalyticsItemInput[] | null {
  return cartSnapshotReader?.() ?? null;
}

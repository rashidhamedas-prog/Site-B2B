/**
 * Torob Order Tracking: every returned row must satisfy
 * purchase_timestamp > purchase_timestamp_gt (ISO UTC).
 * Never widen the window with last_updated — panel validation rejects it.
 */
export function torobPurchaseAfterGt(
  purchaseAt: Date | string | null | undefined,
  purchaseTimestampGt: Date | string,
): boolean {
  const purchase = purchaseAt instanceof Date ? purchaseAt : new Date(String(purchaseAt || ''));
  const gt =
    purchaseTimestampGt instanceof Date
      ? purchaseTimestampGt
      : new Date(String(purchaseTimestampGt || ''));
  if (Number.isNaN(purchase.getTime()) || Number.isNaN(gt.getTime())) return false;
  return purchase.getTime() > gt.getTime();
}

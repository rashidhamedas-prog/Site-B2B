/** When channel stock may move for an order. Pure; no Nest/DB. */

const SETTLED_STATUSES = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as const;

export function shouldCommitStockOnConfirm(previousStatus: string, nextStatus: string): boolean {
  return (
    (SETTLED_STATUSES as readonly string[]).includes(nextStatus) &&
    !(SETTLED_STATUSES as readonly string[]).includes(previousStatus)
  );
}

export function isOrderStockCommitted(order: {
  stockCommittedAt?: Date | string | null;
  effectsReversedAt?: Date | string | null;
}): boolean {
  return Boolean(order.stockCommittedAt) && !order.effectsReversedAt;
}

export function shouldReverseCommittedStock(order: {
  stockCommittedAt?: Date | string | null;
  effectsReversedAt?: Date | string | null;
}): boolean {
  return isOrderStockCommitted(order);
}

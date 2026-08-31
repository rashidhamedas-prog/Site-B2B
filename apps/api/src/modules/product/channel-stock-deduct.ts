/** Same predicate as updateVariantStock CAS: refuse if current < need. */
export function applyChannelDeduct(current: number, qty: number): number {
  const need = Math.abs(Number(qty) || 0);
  const have = Math.max(0, Number(current) || 0);
  if (need === 0) return have;
  if (have < need) throw new Error('OVERSELL');
  return have - need;
}

/** Serial equivalent of two concurrent deducts racing the same row. */
export function simulateSerialDeducts(initial: number, qtys: number[]): { remaining: number; rejected: number } {
  let remaining = initial;
  let rejected = 0;
  for (const qty of qtys) {
    try {
      remaining = applyChannelDeduct(remaining, qty);
    } catch {
      rejected += 1;
    }
  }
  return { remaining, rejected };
}

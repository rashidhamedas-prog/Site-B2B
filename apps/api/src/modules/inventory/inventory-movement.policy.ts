export type StockChannel = 'WHOLESALE' | 'RETAIL';

const POSITIVE_TYPES = new Set(['IN', 'RETURN']);
const NEGATIVE_TYPES = new Set(['OUT', 'SALE', 'DAMAGE']);

export function normalizeStockChannel(channel?: string | null): StockChannel {
  return String(channel || 'WHOLESALE').toUpperCase() === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
}

export function parseAdjustDelta(notes?: string | null): number | null {
  const match = String(notes || '').match(/\bDELTA=(-?\d+)\b/);
  if (!match) return null;
  return Number(match[1]);
}

export function withAdjustDeltaNote(notes: string | undefined, delta: number): string {
  const base = String(notes || '').replace(/\n?DELTA=-?\d+\b/g, '').trim();
  return base ? `${base}\nDELTA=${delta}` : `DELTA=${delta}`;
}

/** Reconstruct the signed stock effect of a ledger row. */
export function signedDeltaForMovement(type: string, quantity: number, notes?: string | null): number {
  const qty = Math.abs(Number(quantity) || 0);
  const t = String(type || '').toUpperCase();
  if (t === 'ADJUST') {
    const parsed = parseAdjustDelta(notes);
    if (parsed != null) return parsed;
    throw new Error('حرکت تصحیح بدون DELTA قابل برگشت نیست');
  }
  if (t === 'REVERSAL') {
    throw new Error('برگشت قابل برگشت دوباره نیست');
  }
  if (POSITIVE_TYPES.has(t)) return qty;
  if (NEGATIVE_TYPES.has(t)) return -qty;
  throw new Error(`نوع حرکت ناشناخته: ${type}`);
}

export function isReversableMovement(type: string): boolean {
  const t = String(type || '').toUpperCase();
  return t !== 'REVERSAL';
}

/** Inventory UI reverse — order/RMA restores only via their own cancel/approve path. */
export function canReverseFromInventoryUi(row: { type?: string; referenceType?: string | null }): boolean {
  if (!isReversableMovement(String(row.type || ''))) return false;
  const ref = String(row.referenceType || '').toUpperCase();
  return ref !== 'ORDER' && ref !== 'RMA';
}

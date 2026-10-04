export const LEDGER_ENTRY_TYPES = [
  'COMMISSION_EARNED',
  'COMMISSION_REVERSAL',
  'MANUAL_ADJUSTMENT',
  'PAYOUT',
  'PAYOUT_REVERSAL',
] as const;
export type SalesLedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export type LedgerRow = {
  amountIrr: number;
  entryType: SalesLedgerEntryType;
  availableAt: Date | null;
  payoutId?: string | null;
  /** Reversal follows the earning it undoes. Missing means available. */
  bucket?: 'held' | 'available';
};

export function assertIrr(amount: number): number {
  if (!Number.isInteger(amount)) throw new Error('INVALID_IRR');
  return amount;
}

export function ledgerBalance(rows: LedgerRow[], now: Date): {
  estimated: number;
  held: number;
  available: number;
  paid: number;
  reversed: number;
  debt: number;
} {
  let held = 0;
  let available = 0;
  let paid = 0;
  let reversed = 0;
  for (const row of rows) {
    const amount = assertIrr(row.amountIrr);
    if (row.entryType === 'COMMISSION_REVERSAL') reversed += Math.abs(amount);
    if (row.entryType === 'PAYOUT') paid += Math.abs(amount);
    if (row.entryType === 'COMMISSION_EARNED' || row.entryType === 'MANUAL_ADJUSTMENT' || row.entryType === 'PAYOUT_REVERSAL') {
      if (!row.availableAt || row.availableAt.getTime() > now.getTime()) held += amount;
      else available += amount;
    } else if (row.entryType === 'COMMISSION_REVERSAL') {
      const bucket = row.bucket ?? 'available';
      if (bucket === 'held') held += amount;
      else available += amount;
    } else {
      available += amount;
    }
  }
  let debt = 0;
  if (available < 0) {
    debt = -available;
    available = 0;
  }
  if (held < 0) {
    debt += -held;
    held = 0;
  }
  return {
    estimated: 0,
    held,
    available,
    paid,
    reversed,
    debt,
  };
}

export type PartnerLedgerTotals = {
  salesPartnerId: string;
  held: number;
  available: number;
  paid: number;
  reversed: number;
  debt: number;
};

/** Same clamp as the program SQL rollup, applied after a partner's own buckets are summed. */
export function clampLedgerTotals(raw: {
  held: number;
  available: number;
  paid: number;
  reversed: number;
}): Omit<PartnerLedgerTotals, 'salesPartnerId'> {
  let held = raw.held;
  let available = raw.available;
  let debt = 0;
  if (available < 0) {
    debt += -available;
    available = 0;
  }
  if (held < 0) {
    debt += -held;
    held = 0;
  }
  return { held, available, paid: raw.paid, reversed: raw.reversed, debt };
}

export function partnerTotalsFromBucketRows(
  rows: Array<{ salesPartnerId: string; bucket: string; amountIrr: number }>,
): PartnerLedgerTotals[] {
  const grouped = new Map<string, { held: number; available: number; paid: number; reversed: number }>();
  for (const row of rows) {
    if (!row.salesPartnerId || row.bucket === 'skip') continue;
    if (row.bucket !== 'held' && row.bucket !== 'available' && row.bucket !== 'paid' && row.bucket !== 'reversed') continue;
    const current = grouped.get(row.salesPartnerId) || { held: 0, available: 0, paid: 0, reversed: 0 };
    current[row.bucket] += row.amountIrr;
    grouped.set(row.salesPartnerId, current);
  }
  const out: PartnerLedgerTotals[] = [];
  for (const [salesPartnerId, raw] of grouped) {
    const totals = clampLedgerTotals(raw);
    if (totals.held === 0 && totals.available === 0 && totals.paid === 0 && totals.reversed === 0 && totals.debt === 0) continue;
    out.push({ salesPartnerId, ...totals });
  }
  return out.sort((a, b) => a.salesPartnerId.localeCompare(b.salesPartnerId));
}

export type PartnerLedgerTotals = {
  salesPartnerId: string;
  held: number;
  available: number;
  paid: number;
  reversed: number;
  debt: number;
};

/** Same clamp as the program SQL rollup, applied after each partner's own sums. */
export function clampLedgerTotals(raw: {
  held: number;
  available: number;
  paid: number;
  reversed: number;
}): Omit<PartnerLedgerTotals, 'salesPartnerId'> {
  let held = raw.held;
  let available = raw.available;
  let debt = 0;
  if (available < 0) {
    debt += -available;
    available = 0;
  }
  if (held < 0) {
    debt += -held;
    held = 0;
  }
  return { held, available, paid: raw.paid, reversed: raw.reversed, debt };
}

export function partnerTotalsFromBucketRows(
  rows: Array<{ salesPartnerId: string; bucket: string; amountIrr: number }>,
): PartnerLedgerTotals[] {
  const grouped = new Map<string, { held: number; available: number; paid: number; reversed: number }>();
  for (const row of rows) {
    if (!row.salesPartnerId || row.bucket === 'skip') continue;
    if (row.bucket !== 'held' && row.bucket !== 'available' && row.bucket !== 'paid' && row.bucket !== 'reversed') continue;
    const current = grouped.get(row.salesPartnerId) || { held: 0, available: 0, paid: 0, reversed: 0 };
    current[row.bucket] += row.amountIrr;
    grouped.set(row.salesPartnerId, current);
  }
  const out: PartnerLedgerTotals[] = [];
  for (const [salesPartnerId, raw] of grouped) {
    const totals = clampLedgerTotals(raw);
    if (totals.held === 0 && totals.available === 0 && totals.paid === 0 && totals.reversed === 0 && totals.debt === 0) continue;
    out.push({ salesPartnerId, ...totals });
  }
  return out.sort((a, b) => a.salesPartnerId.localeCompare(b.salesPartnerId));
}

export function canAutoRelease(holdDays: number | null | undefined): boolean {
  return Number.isInteger(holdDays) && Number(holdDays) > 0;
}

export function availableAtFromDelivery(deliveredAt: Date, holdDays: number): Date {
  if (!canAutoRelease(holdDays)) throw new Error('HOLD_NOT_CONFIGURED');
  return new Date(deliveredAt.getTime() + holdDays * 24 * 60 * 60 * 1000);
}

export function payoutIdempotencyKey(salesPartnerId: string, requestHash: string): string {
  return boundedIdempotencyKey('payout', `${salesPartnerId}:${requestHash}`);
}

export type PayoutSource = {
  id: string;
  amountIrr: number;
  entryType: SalesLedgerEntryType;
  availableAt: Date | null;
  payoutId?: string | null;
  bucket?: 'held' | 'available';
  orderItemId?: string | null;
};

/**
 * Pay the net available balance. Unpaid reversals reduce what can leave.
 * If reversals exceed unpaid earnings, the remainder is debt carried forward
 * and is not paid. History rows are not rewritten.
 */
export function allocatePayoutIrr(rows: PayoutSource[], now: Date): {
  amountIrr: number;
  entryIds: string[];
  debtIrr: number;
} {
  const open = rows.filter((row) => !row.payoutId);
  const earningByItem = new Map<string, PayoutSource>();
  for (const row of open) {
    if (row.entryType === 'COMMISSION_EARNED' && row.orderItemId) earningByItem.set(row.orderItemId, row);
  }
  const earnedIds: string[] = [];
  const reversalIds: string[] = [];
  let earned = 0;
  let reversal = 0;
  for (const row of open) {
    const amount = assertIrr(row.amountIrr);
    if (row.entryType === 'COMMISSION_EARNED' && isPayableEarned(row, now)) {
      earned += amount;
      earnedIds.push(row.id);
    } else if (row.entryType === 'COMMISSION_REVERSAL' && reversalCountsTowardPayout(row, earningByItem, now)) {
      reversal += Math.abs(amount);
      reversalIds.push(row.id);
    } else if (row.entryType === 'MANUAL_ADJUSTMENT' && row.availableAt && row.availableAt.getTime() <= now.getTime()) {
      if (amount >= 0) {
        earned += amount;
        earnedIds.push(row.id);
      } else {
        reversal += Math.abs(amount);
        reversalIds.push(row.id);
      }
    }
  }
  const net = earned - reversal;
  if (net <= 0) {
    return { amountIrr: 0, entryIds: [], debtIrr: reversal > earned ? reversal - earned : 0 };
  }
  return { amountIrr: net, entryIds: [...earnedIds, ...reversalIds], debtIrr: 0 };
}

/** A reversal reduces a payout only after its own earning is releasable, or after that earning has already left the open set. */
function reversalCountsTowardPayout(
  row: PayoutSource,
  earningByItem: Map<string, PayoutSource>,
  now: Date,
): boolean {
  const earning = row.orderItemId ? earningByItem.get(row.orderItemId) : undefined;
  if (!earning) return true;
  return isPayableEarned(earning, now);
}

export function isPayableEarned(
  row: LedgerRow & { payoutId?: string | null },
  now: Date,
): boolean {
  return (
    row.entryType === 'COMMISSION_EARNED'
    && !row.payoutId
    && !!row.availableAt
    && row.availableAt.getTime() <= now.getTime()
    && row.amountIrr > 0
  );
}

export type LedgerCursor = { cursorAt: Date | null; cursorId: string | null };

/** Walk oldest-first. A short page means the pass is done and the next pass starts over. */
export function advanceLedgerCursor(
  rows: { id: string; updatedAt: Date }[],
  limit: number,
): LedgerCursor & { wrapped: boolean } {
  if (rows.length === 0 || rows.length < limit) {
    return { cursorAt: null, cursorId: null, wrapped: true };
  }
  const last = rows[rows.length - 1];
  return { cursorAt: last.updatedAt, cursorId: last.id, wrapped: false };
}

export function convertIdempotencyKey(draftId: string): string {
  return `sales-partner-convert:${draftId}`;
}

export function earnedIdempotencyKey(orderId: string, orderItemId: string): string {
  return boundedIdempotencyKey('earned', `${orderId}:${orderItemId}`);
}

export function reversalIdempotencyKey(orderId: string, orderItemId: string, reason: string): string {
  return boundedIdempotencyKey('reversal', `${orderId}:${orderItemId}:${reason}`);
}

const IDEMPOTENCY_MAX = 80;

/** Stable short key. Full identity is hashed so truncation cannot collide distinct ops. */
export function boundedIdempotencyKey(kind: string, identity: string): string {
  const prefix = `sp:${kind}:`;
  let hash = 0xcbf29ce484222325n;
  const bytes = Buffer.from(identity, 'utf8');
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  const digest = hash.toString(16).padStart(16, '0');
  const key = `${prefix}${digest}`;
  if (key.length > IDEMPOTENCY_MAX) throw new Error('IDEMPOTENCY_KEY_TOO_LONG');
  return key;
}

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
    } else {
      available += amount;
    }
  }
  return {
    estimated: 0,
    held,
    available,
    paid,
    reversed,
  };
}

export function canAutoRelease(holdDays: number | null | undefined): boolean {
  return Number.isInteger(holdDays) && Number(holdDays) > 0;
}

export function availableAtFromDelivery(deliveredAt: Date, holdDays: number): Date {
  if (!canAutoRelease(holdDays)) throw new Error('HOLD_NOT_CONFIGURED');
  return new Date(deliveredAt.getTime() + holdDays * 24 * 60 * 60 * 1000);
}

export function payoutIdempotencyKey(batchKey: string): string {
  return `sales-partner-payout:${batchKey}`;
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

export function convertIdempotencyKey(draftId: string): string {
  return `sales-partner-convert:${draftId}`;
}

export function earnedIdempotencyKey(orderId: string, orderItemId: string): string {
  return `sales-partner-earned:${orderId}:${orderItemId}`;
}

export function reversalIdempotencyKey(orderId: string, orderItemId: string, reason: string): string {
  return `sales-partner-reversal:${orderId}:${orderItemId}:${reason}`;
}

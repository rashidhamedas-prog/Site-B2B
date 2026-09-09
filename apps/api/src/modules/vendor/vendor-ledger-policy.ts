/** Pure vendor ledger rules — no Nest. */

export type VendorLedgerStatus = 'HELD' | 'AVAILABLE' | 'PAID';
export type VendorLedgerEntryType = 'COMMISSION_ACCRUAL' | 'PAYOUT' | 'REVERSAL';

/** Net IRR owed to partner after Taranom commission cut. */
export function vendorNetPayableIrr(goodsTotal: number, commissionTotal: number): number {
  const goods = Math.max(0, Math.floor(Number(goodsTotal) || 0));
  const commission = Math.max(0, Math.floor(Number(commissionTotal) || 0));
  return Math.max(0, goods - commission);
}

export function ledgerAvailableAt(deliveredAt: Date, holdDays: number): Date {
  const days = Math.max(0, Math.floor(Number(holdDays) || 0));
  return new Date(deliveredAt.getTime() + days * 24 * 60 * 60 * 1000);
}

export function resolveLedgerStatus(
  status: string,
  availableAt: Date | string,
  now: Date = new Date(),
): VendorLedgerStatus {
  if (status === 'PAID') return 'PAID';
  const t = availableAt instanceof Date ? availableAt.getTime() : new Date(availableAt).getTime();
  if (Number.isFinite(t) && t <= now.getTime()) return 'AVAILABLE';
  return 'HELD';
}

export function canPartnerDeliverStatus(status: string | null | undefined): boolean {
  return status === 'SHIPPED';
}

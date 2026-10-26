/** Provider credit minus parts reserved for in-flight messages. */
export function availableCreditFrom(providerCredit: number, reservedParts: number): number {
  const credit = Math.max(0, Math.floor(providerCredit));
  const reserved = Math.max(0, Math.floor(reservedParts));
  return Math.max(0, credit - reserved);
}

export const CREDIT_RESERVE_STATUSES = ['QUEUED', 'SENDING', 'PAUSED'] as const;

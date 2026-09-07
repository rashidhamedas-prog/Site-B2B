/** Site channel for CRM / reports. `type` is the source of truth. */

export type CustomerChannel = 'WHOLESALE' | 'RETAIL';

export function normalizeCustomerChannel(raw?: string): CustomerChannel | undefined {
  const c = String(raw || '').toUpperCase();
  if (c === 'RETAIL') return 'RETAIL';
  if (c === 'WHOLESALE') return 'WHOLESALE';
  return undefined;
}

export function isRetailCustomerType(type?: string | null): boolean {
  const t = String(type || '').toUpperCase();
  return t === 'RETAIL' || t === 'B2C';
}

/** SQL fragment against a customer alias (no user input interpolated). */
export function customerChannelSql(alias: string, channel: CustomerChannel): string {
  const col = `${alias}.type`;
  if (channel === 'RETAIL') {
    return `UPPER(COALESCE(${col}, '')) IN ('RETAIL', 'B2C')`;
  }
  return `UPPER(COALESCE(${col}, '')) NOT IN ('RETAIL', 'B2C')`;
}

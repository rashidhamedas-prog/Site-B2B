export type SaleChannel = 'RETAIL' | 'WHOLESALE';

export type CashOnDeliveryFlags = {
  retailCashEnabled: boolean;
  wholesaleCashEnabled: boolean;
};

/**
 * Retail COD is opt-in. The storefront used to hard-code CASH even after the
 * operator removed «پرداخت درب منزل» from settings. Unset = hidden on .ir.
 * Wholesale cash is also opt-in so «پرداخت درب منزل / نقدی» stays off
 * until the operator turns the admin switch on.
 */
export function resolveCashOnDeliveryFlags(raw?: unknown): CashOnDeliveryFlags {
  const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    retailCashEnabled: s.retailCashEnabled === true,
    wholesaleCashEnabled: s.wholesaleCashEnabled === true,
  };
}

export function isCashOnDeliveryEnabled(
  channel: SaleChannel,
  flags: Partial<CashOnDeliveryFlags> | null | undefined,
): boolean {
  if (channel === 'RETAIL') return flags?.retailCashEnabled === true;
  return flags?.wholesaleCashEnabled === true;
}

export function allowedOrderPaymentMethods(
  channel: SaleChannel,
  flags: Partial<CashOnDeliveryFlags> | null | undefined,
): string[] {
  const cash = isCashOnDeliveryEnabled(channel, flags);
  if (channel === 'RETAIL') return cash ? ['CASH', 'ONLINE'] : ['ONLINE'];
  return cash ? ['CASH', 'INSTALLMENT', 'ONLINE'] : ['INSTALLMENT', 'ONLINE'];
}

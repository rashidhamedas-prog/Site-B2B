export function rmaRefundLabelFa(refundType?: string | null): string {
  const key = String(refundType || '').toUpperCase();
  if (key === 'BANK') return 'کارت / بانک';
  if (key === 'WALLET') return 'کیف پول';
  return key || '—';
}

export function rmaWalletCreditLabelFa(rial?: number | string | null): string {
  const n = Number(rial);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${Math.round(n / 10).toLocaleString('fa-IR')} ت`;
}

export function adminCustomerWorkspaceHref(
  customerId: string,
  tab?: 'orders' | 'wallet' | 'identity',
): string {
  const id = String(customerId || '').trim();
  if (!id) return '/admin/customers';
  if (tab === 'orders' || tab === 'wallet') return `/admin/customers/${id}?tab=${tab}`;
  return `/admin/customers/${id}`;
}

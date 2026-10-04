/**
 * Report joins cross uuid primary keys and varchar foreign keys.
 * Postgres has no uuid = varchar operator, so every comparison is text.
 */

const ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/;

function sqlAlias(name: string): string {
  if (!ALIAS.test(name)) throw new Error('invalid sql alias');
  return name;
}

/** orders.id is uuid; order_items.orderId is varchar. */
export function orderMatchesItemSql(orderAlias = 'o', itemAlias = 'i'): string {
  const order = sqlAlias(orderAlias);
  const item = sqlAlias(itemAlias);
  return `${order}.id::text = ${item}."orderId"`;
}

/** product_variants.id is uuid; order_items.productVariantId is varchar. */
export function variantMatchesOrderItemSql(variantAlias = 'v', itemAlias = 'i'): string {
  const variant = sqlAlias(variantAlias);
  const item = sqlAlias(itemAlias);
  return `${variant}.id::text = ${item}."productVariantId"`;
}

/** products.id is uuid; product_variants.productId is varchar. */
export function productMatchesVariantSql(productAlias = 'p', variantAlias = 'v'): string {
  const product = sqlAlias(productAlias);
  const variant = sqlAlias(variantAlias);
  return `${product}.id::text = ${variant}."productId"`;
}

/** customers.id is uuid; orders.customerId is varchar. */
export function customerMatchesOrderSql(customerAlias = 'c', orderAlias = 'o'): string {
  const customer = sqlAlias(customerAlias);
  const order = sqlAlias(orderAlias);
  return `${customer}.id::text = ${order}."customerId"`;
}

/** orders.id is uuid; return_requests.orderId is varchar. */
export function orderMatchesReturnSql(orderAlias = 'o', returnAlias = 'r'): string {
  const order = sqlAlias(orderAlias);
  const row = sqlAlias(returnAlias);
  return `${order}.id::text = ${row}."orderId"`;
}

/** customers.id is uuid; invoices.customerId is varchar. */
export function customerMatchesInvoiceSql(customerAlias = 'c', invoiceAlias = 'i'): string {
  const customer = sqlAlias(customerAlias);
  const invoice = sqlAlias(invoiceAlias);
  return `${customer}.id::text = ${invoice}."customerId"`;
}

const PAYMENT_LABELS: Record<string, string> = {
  ONLINE: 'آنلاین',
  CASH: 'نقد / در محل',
  CREDIT: 'اعتباری',
  INSTALLMENT: 'اقساط',
  ZARINPAL: 'زرین‌پال',
  DIGIPAY: 'دیجی‌پی',
  TOROBPAY: 'ترب‌پی',
  WALLET: 'کیف پول',
  UNKNOWN: 'نامشخص',
};

export function paymentLabel(method?: string | null): string {
  const key = String(method || '').trim().toUpperCase() || 'UNKNOWN';
  return PAYMENT_LABELS[key] ?? key;
}

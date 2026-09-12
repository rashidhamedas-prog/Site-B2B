/** Customer invoice read rules. Keep UUID guard out of TypeORM so Postgres never 500s. */

export const INVOICE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isInvoiceUuid(id: string | null | undefined): boolean {
  return INVOICE_UUID_RE.test(String(id || ''));
}

export function emptyInvoiceList(page: number, limit: number) {
  return { data: [] as never[], meta: { page, limit, total: 0, totalPages: 0 } };
}

export function escapeInvoiceHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * npx ts-node --transpile-only src/modules/invoice/invoice-access.spec.ts
 */
import { emptyInvoiceList, escapeInvoiceHtml, isInvoiceUuid } from './invoice-access';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isInvoiceUuid('00000000-0000-4000-8000-000000000001') === true, 'uuid ok');
assert(isInvoiceUuid('not-a-uuid') === false, 'slug is not uuid');
assert(isInvoiceUuid('') === false, 'empty id');
assert(isInvoiceUuid(null) === false, 'null id');

const empty = emptyInvoiceList(1, 20);
assert(empty.data.length === 0, 'empty data');
assert(empty.meta.total === 0, 'empty total');

assert(!escapeInvoiceHtml('<script>x</script>').includes('<script>'), 'script escaped');
assert(escapeInvoiceHtml('پوشاک & ترنم').includes('&amp;'), 'amp escaped');
assert(escapeInvoiceHtml(null) === '', 'null to empty');

console.log('invoice-access.spec.ts: OK');

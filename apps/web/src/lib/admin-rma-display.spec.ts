/**
 * npx ts-node --transpile-only src/lib/admin-rma-display.spec.ts
 */
import assert from 'node:assert/strict';
import {
  adminCustomerWorkspaceHref,
  rmaRefundLabelFa,
  rmaWalletCreditLabelFa,
} from './admin-rma-display.ts';

assert.equal(rmaRefundLabelFa('WALLET'), 'کیف پول');
assert.equal(rmaRefundLabelFa('BANK'), 'کارت / بانک');
assert.equal(rmaRefundLabelFa(''), '—');
assert.equal(rmaRefundLabelFa(undefined), '—');

assert.equal(rmaWalletCreditLabelFa(null), '—');
assert.equal(rmaWalletCreditLabelFa(0), '—');
assert.equal(rmaWalletCreditLabelFa(125000), '۱۲٬۵۰۰ ت');
assert.equal(rmaWalletCreditLabelFa('125000'), '۱۲٬۵۰۰ ت');

assert.equal(adminCustomerWorkspaceHref('abc'), '/admin/customers/abc');
assert.equal(adminCustomerWorkspaceHref('abc', 'orders'), '/admin/customers/abc?tab=orders');
assert.equal(adminCustomerWorkspaceHref('abc', 'wallet'), '/admin/customers/abc?tab=wallet');
assert.equal(adminCustomerWorkspaceHref('abc', 'addresses'), '/admin/customers/abc?tab=addresses');
assert.equal(adminCustomerWorkspaceHref(''), '/admin/customers');

console.log('admin-rma-display.spec.ts: ok');

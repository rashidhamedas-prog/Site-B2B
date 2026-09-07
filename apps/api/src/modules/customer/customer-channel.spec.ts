import * as assert from 'node:assert/strict';
import {
  customerChannelSql,
  isRetailCustomerType,
  normalizeCustomerChannel,
} from './customer-channel';

assert.equal(normalizeCustomerChannel('retail'), 'RETAIL');
assert.equal(normalizeCustomerChannel('WHOLESALE'), 'WHOLESALE');
assert.equal(normalizeCustomerChannel('all'), undefined);

assert.equal(isRetailCustomerType('B2C'), true);
assert.equal(isRetailCustomerType('RETAIL'), true);
assert.equal(isRetailCustomerType('B2B'), false);
assert.equal(isRetailCustomerType('WHOLESALE'), false);

assert.equal(
  customerChannelSql('c', 'RETAIL'),
  "UPPER(COALESCE(c.type, '')) IN ('RETAIL', 'B2C')",
);
assert.equal(
  customerChannelSql('c', 'WHOLESALE'),
  "UPPER(COALESCE(c.type, '')) NOT IN ('RETAIL', 'B2C')",
);

console.log('customer-channel.spec.ts: OK');

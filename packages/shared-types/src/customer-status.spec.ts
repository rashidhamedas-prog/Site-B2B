/**
 * npx ts-node --transpile-only src/customer-status.spec.ts
 */
import {
  customerChannelLabelFa,
  customerChannelOf,
  customerStatusLabelFa,
  isCustomerAccountStatus,
  isCustomerListChannel,
  isRetailCustomerType,
} from './customer-status';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isCustomerAccountStatus('ACTIVE'), 'active known');
assert(!isCustomerAccountStatus('DELETED'), 'deleted not a customer account status');
assert(isCustomerListChannel('ALL'), 'all channel');
assert(isRetailCustomerType('B2C'), 'b2c is retail');
assert(isRetailCustomerType('retail'), 'retail type');
assert(!isRetailCustomerType('B2B'), 'b2b is wholesale');
assert(customerChannelOf('B2C') === 'RETAIL', 'channel of b2c');
assert(customerChannelOf('WHOLESALE') === 'WHOLESALE', 'channel of wholesale');
assert(customerStatusLabelFa('PENDING') === 'در انتظار تأیید', 'pending label');
assert(customerStatusLabelFa('ACTIVE') === 'فعال', 'active label');
assert(customerChannelLabelFa('RETAIL') === 'تکی', 'retail label');
assert(customerChannelLabelFa('B2B') === 'عمده', 'b2b label');
console.log('customer-status.spec.ts: ok');

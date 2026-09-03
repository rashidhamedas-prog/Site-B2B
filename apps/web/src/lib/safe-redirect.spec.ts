import { safeAccountRedirect } from './safe-redirect';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(safeAccountRedirect('/checkout') === '/checkout', 'relative ok');
assert(safeAccountRedirect('/account/orders') === '/account/orders', 'nested ok');
assert(safeAccountRedirect('https://evil.com') === '/account', 'absolute blocked');
assert(safeAccountRedirect('//evil.com') === '/account', 'protocol-relative blocked');
assert(safeAccountRedirect('javascript:alert(1)') === '/account', 'scheme blocked');
assert(safeAccountRedirect(null) === '/account', 'empty');

console.log('safe-redirect.spec.ts: OK');

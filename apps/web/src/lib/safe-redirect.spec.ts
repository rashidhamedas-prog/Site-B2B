import { safeAccountRedirect, safeScopedRedirect } from './safe-redirect';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(safeAccountRedirect('/checkout') === '/checkout', 'relative ok');
assert(safeAccountRedirect('/account/orders') === '/account/orders', 'nested ok');
assert(safeAccountRedirect('https://evil.com') === '/account', 'absolute blocked');
assert(safeAccountRedirect('//evil.com') === '/account', 'protocol-relative blocked');
assert(safeAccountRedirect('javascript:alert(1)') === '/account', 'scheme blocked');
assert(safeAccountRedirect(null) === '/account', 'empty');

assert(safeScopedRedirect('/portal/dashboard/orders', '/portal/dashboard', ['/portal']) === '/portal/dashboard/orders', 'portal ok');
assert(safeScopedRedirect('/admin/settings', '/portal/dashboard', ['/portal']) === '/portal/dashboard', 'admin blocked on portal');
assert(safeScopedRedirect('https://evil.com', '/portal/dashboard', ['/portal']) === '/portal/dashboard', 'absolute blocked');
assert(safeScopedRedirect('/portal/login', '/portal/dashboard', ['/portal']) === '/portal/dashboard', 'login loop blocked');
assert(safeScopedRedirect('/admin/users', '/admin', ['/admin']) === '/admin/users', 'admin ok');

console.log('safe-redirect.spec.ts: OK');

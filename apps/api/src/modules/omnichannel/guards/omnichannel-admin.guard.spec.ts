/**
 * npx ts-node --transpile-only src/modules/omnichannel/guards/omnichannel-admin.guard.spec.ts
 */
import { isActiveAdmin } from './omnichannel-admin.guard';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isActiveAdmin({ role: 'ADMIN', isActive: true }) === true, 'db admin');
assert(isActiveAdmin({ role: 'ADMIN' }) === true, 'legacy active null');
assert(isActiveAdmin({ role: 'CUSTOMER', isActive: true }) === false, 'jwt role alone is not enough');
assert(isActiveAdmin({ role: 'ADMIN', isActive: false }) === false, 'disabled admin');
assert(isActiveAdmin(null) === false, 'missing user');

console.log('omnichannel-admin.guard.spec.ts: ok');

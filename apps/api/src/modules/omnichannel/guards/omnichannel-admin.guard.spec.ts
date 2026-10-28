/**
 * npx ts-node --transpile-only src/modules/omnichannel/guards/omnichannel-admin.guard.spec.ts
 */
import { isActiveAdmin } from './omnichannel-admin.guard';
import { resolveOmnichannelRole } from '../omnichannel-rbac';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isActiveAdmin({ role: 'ADMIN', isActive: true }) === true, 'db admin');
assert(isActiveAdmin({ role: 'ADMIN' }) === true, 'legacy active null');
assert(isActiveAdmin({ role: 'CUSTOMER', isActive: true }) === false, 'jwt role alone is not enough');
assert(isActiveAdmin({ role: 'ADMIN', isActive: false }) === false, 'disabled admin');
assert(isActiveAdmin(null) === false, 'missing user');

const prevRbac = process.env.OMNICHANNEL_RBAC_ENABLED;
const prevOwners = process.env.OMNICHANNEL_OWNER_USER_IDS;
process.env.OMNICHANNEL_RBAC_ENABLED = 'true';
process.env.OMNICHANNEL_OWNER_USER_IDS = 'hamed-uuid';

assert(
  resolveOmnichannelRole({ id: 'hamed-uuid', omnichannelRole: null }) === 'OWNER',
  'guard path: allowlist OWNER',
);
assert(
  resolveOmnichannelRole({ id: 'other', omnichannelRole: 'PUBLISHER' }) === 'PUBLISHER',
  'guard path: column PUBLISHER',
);
assert(
  resolveOmnichannelRole({ id: 'other', omnichannelRole: 'VIEWER' }) === 'VIEWER',
  'guard path: column VIEWER',
);

delete process.env.OMNICHANNEL_RBAC_ENABLED;
assert(
  resolveOmnichannelRole({ id: 'other', omnichannelRole: 'VIEWER' }) === 'OWNER',
  'flag off ignores column (full ADMIN access)',
);

if (prevRbac === undefined) delete process.env.OMNICHANNEL_RBAC_ENABLED;
else process.env.OMNICHANNEL_RBAC_ENABLED = prevRbac;
if (prevOwners === undefined) delete process.env.OMNICHANNEL_OWNER_USER_IDS;
else process.env.OMNICHANNEL_OWNER_USER_IDS = prevOwners;

console.log('omnichannel-admin.guard.spec.ts: ok');

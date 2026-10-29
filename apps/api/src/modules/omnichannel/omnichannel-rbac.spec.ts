/**
 * npx ts-node --transpile-only src/modules/omnichannel/omnichannel-rbac.spec.ts
 */
import {
  actionRequiresGoRef,
  assertGoRefPresent,
  GO_REF_REQUIRED_MESSAGE,
  isOmnichannelRbacEnabled,
  redactAuditPayloadSummary,
  resolveOmnichannelRole,
  roleMeetsMinimum,
} from './omnichannel-rbac';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const prevRbac = process.env.OMNICHANNEL_RBAC_ENABLED;
const prevOwners = process.env.OMNICHANNEL_OWNER_USER_IDS;

delete process.env.OMNICHANNEL_RBAC_ENABLED;
assert(isOmnichannelRbacEnabled() === false, 'RBAC default off');
assert(
  resolveOmnichannelRole({ userId: 'u1', columnRole: null }) === 'OWNER',
  'flag off → every admin is OWNER',
);

process.env.OMNICHANNEL_RBAC_ENABLED = 'true';
process.env.OMNICHANNEL_OWNER_USER_IDS = 'owner-1, owner-2';
assert(isOmnichannelRbacEnabled() === true, 'RBAC on');
assert(
  resolveOmnichannelRole({ userId: 'owner-1', columnRole: null }) === 'OWNER',
  'allowlist → OWNER',
);
assert(
  resolveOmnichannelRole({ id: 'staff-a', omnichannelRole: null }) === 'PUBLISHER',
  'null column → PUBLISHER when RBAC on',
);
assert(
  resolveOmnichannelRole({ userId: 'x', columnRole: 'VIEWER' }) === 'VIEWER',
  'explicit VIEWER',
);
assert(
  resolveOmnichannelRole({ userId: 'owner-1', columnRole: 'VIEWER' }) === 'VIEWER',
  'explicit column wins over allowlist',
);

assert(roleMeetsMinimum('OWNER', 'PUBLISHER') === true, 'OWNER ≥ PUBLISHER');
assert(roleMeetsMinimum('VIEWER', 'PUBLISHER') === false, 'VIEWER < PUBLISHER');
assert(roleMeetsMinimum('PUBLISHER', 'VIEWER') === true, 'PUBLISHER ≥ VIEWER');

assert(actionRequiresGoRef('publications_requeue_by_category_live') === true, 'live requeue needs GO');
assert(actionRequiresGoRef('coverage_out_of_panel_ingest') === true, 'coverage ingest needs GO');
assert(actionRequiresGoRef('deliveries_retry') === false, 'retry no GO');
assert(roleMeetsMinimum('VIEWER', 'VIEWER') === true, 'coverage GET role VIEWER ok');
assert(roleMeetsMinimum('VIEWER', 'PUBLISHER') === false, 'viewer cannot absence-reason write');
assert(roleMeetsMinimum('PUBLISHER', 'OWNER') === false, 'publisher cannot oop reconcile');
assert(roleMeetsMinimum('OWNER', 'OWNER') === true, 'owner can oop reconcile');
assert(roleMeetsMinimum('PUBLISHER', 'PUBLISHER') === true, 'composer/plan → PUBLISHER');
assert(roleMeetsMinimum('VIEWER', 'PUBLISHER') === false, 'viewer cannot composer/plan');
assert(roleMeetsMinimum('PUBLISHER', 'PUBLISHER') === true, 'media validate/scan → PUBLISHER');
assert(roleMeetsMinimum('VIEWER', 'PUBLISHER') === false, 'viewer cannot media scan');
assert(roleMeetsMinimum('VIEWER', 'VIEWER') === true, 'media health GET → VIEWER');
assert(
  actionRequiresGoRef('publications_requeue_by_category_live') === true,
  'composer bulk requeue live → OWNER+goRef',
);

try {
  assertGoRefPresent('  ');
  throw new Error('empty goRef should throw');
} catch (err) {
  assert(err instanceof Error && err.message === GO_REF_REQUIRED_MESSAGE, 'goRef Persian 400 message');
}
assert(assertGoRefPresent(' GO حامد 2026-10-28 ') === 'GO حامد 2026-10-28', 'trim goRef');

const summary = redactAuditPayloadSummary({
  matched: 3,
  queued: 2,
  token: 'should-drop',
  secret: 'nope',
  destinationId: 'd1',
});
assert(summary.matched === 3 && summary.destinationId === 'd1', 'keeps counts/ids');
assert(!('token' in summary) && !('secret' in summary), 'drops secret-shaped keys');

if (prevRbac === undefined) delete process.env.OMNICHANNEL_RBAC_ENABLED;
else process.env.OMNICHANNEL_RBAC_ENABLED = prevRbac;
if (prevOwners === undefined) delete process.env.OMNICHANNEL_OWNER_USER_IDS;
else process.env.OMNICHANNEL_OWNER_USER_IDS = prevOwners;

console.log('omnichannel-rbac.spec.ts: ok');

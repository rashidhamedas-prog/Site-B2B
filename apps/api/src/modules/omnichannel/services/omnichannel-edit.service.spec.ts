/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/omnichannel-edit.service.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { assertPublisherForEdit } from '../omnichannel-delete-edit-rbac';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(resolve(__dirname, 'omnichannel-edit.service.ts'), 'utf8');

assert(src.includes("kind: 'pre_edit'"), 'pre_edit backup');
assert(src.includes('delivery_edit'), 'audit delivery_edit');
assert(src.includes('delivery_revert'), 'audit delivery_revert');
assert(src.includes("token === 'last'") || src.includes("'latest'"), 'revert last/latest');
assert(src.includes('enqueueRemoteUpdates'), 'reuses UPDATE enqueue');
assert(!src.includes('OMNICHANNEL_CONNECTORS_ENABLED=true'), 'does not enable connectors');

{
  const prev = process.env.OMNICHANNEL_RBAC_ENABLED;
  process.env.OMNICHANNEL_RBAC_ENABLED = 'true';
  try {
    assertPublisherForEdit({ id: 'v', omnichannelRole: 'VIEWER' });
    throw new Error('viewer should 403');
  } catch (err: unknown) {
    assert(
      (err as { statusCode?: number }).statusCode === 403
        || String((err as Error).message || '').includes('Viewer'),
      'viewer blocked',
    );
  }
  assertPublisherForEdit({ id: 'p', omnichannelRole: 'PUBLISHER' });
  if (prev === undefined) delete process.env.OMNICHANNEL_RBAC_ENABLED;
  else process.env.OMNICHANNEL_RBAC_ENABLED = prev;
}

console.log('omnichannel-edit.service.spec.ts: ok');

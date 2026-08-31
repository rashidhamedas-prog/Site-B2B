/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/publication-sync.spec.ts
 */
import { nextPublicationAction, syncChannelsForEvent } from './publication-sync';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(nextPublicationAction(null, true) === 'create', 'new publishable');
assert(nextPublicationAction(null, false) === 'skip', 'new hidden');
assert(nextPublicationAction({ status: 'DRAFT' }, true) === 'update', 'refresh draft');
assert(nextPublicationAction({ status: 'PUBLISHED' }, true) === 'refresh', 'live snapshot only');
assert(nextPublicationAction({ status: 'PUBLISHED' }, false) === 'withdraw', 'hide live');
assert(nextPublicationAction({ status: 'WITHDRAWN' }, true) === 'reopen', 'visible again');
assert(nextPublicationAction({ status: 'WITHDRAWN' }, false) === 'skip', 'stay withdrawn');
assert(nextPublicationAction({ status: 'FAILED' }, true) === 'refresh', 'failed keeps status');
assert(syncChannelsForEvent('RETAIL').join(',') === 'RETAIL', 'channel scoped');
assert(syncChannelsForEvent(null).join(',') === 'RETAIL,WHOLESALE', 'both when unscoped');
assert(nextPublicationAction({ status: 'PUBLISHED' }, false) !== 'create', 'withdraw never creates delivery');

console.log('publication-sync.spec.ts: ok');

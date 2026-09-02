/**
 * npx ts-node --transpile-only src/modules/collection/collection-public-channel.spec.ts
 */
import { requirePublicCollectionChannel } from './collection-public-channel';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(requirePublicCollectionChannel('retail') === 'RETAIL', 'retail allowed');
assert(requirePublicCollectionChannel('WHOLESALE') === 'WHOLESALE', 'wholesale allowed');

for (const banned of [undefined, '', 'ALL', 'BOTH', 'portal']) {
  let threw = false;
  try {
    requirePublicCollectionChannel(banned);
  } catch (err) {
    threw = err instanceof Error && err.message === 'PUBLIC_CHANNEL_REQUIRED';
  }
  assert(threw, `${banned ?? 'undefined'} must be rejected for public collections`);
}

console.log('collection-public-channel.spec.ts: ok');

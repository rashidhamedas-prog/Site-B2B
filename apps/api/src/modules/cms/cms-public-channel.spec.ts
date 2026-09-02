/**
 * npx ts-node --transpile-only src/modules/cms/cms-public-channel.spec.ts
 */
import { requirePublicCmsChannel } from './cms-public-channel';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(requirePublicCmsChannel('retail') === 'RETAIL', 'retail allowed');
assert(requirePublicCmsChannel('WHOLESALE') === 'WHOLESALE', 'wholesale allowed');

for (const banned of [undefined, '', 'ALL', 'BOTH', 'portal']) {
  let threw = false;
  try {
    requirePublicCmsChannel(banned);
  } catch (err) {
    threw = err instanceof Error && err.message === 'PUBLIC_CHANNEL_REQUIRED';
  }
  assert(threw, `${banned ?? 'undefined'} must be rejected for public CMS`);
}

console.log('cms-public-channel.spec.ts: ok');

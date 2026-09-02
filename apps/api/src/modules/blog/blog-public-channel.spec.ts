/**
 * npx ts-node --transpile-only src/modules/blog/blog-public-channel.spec.ts
 */
import { requirePublicBlogChannel } from './blog-public-channel';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(requirePublicBlogChannel('retail') === 'RETAIL', 'retail allowed');
assert(requirePublicBlogChannel('WHOLESALE') === 'WHOLESALE', 'wholesale allowed');

for (const banned of [undefined, '', 'ALL', 'BOTH', 'portal']) {
  let threw = false;
  try {
    requirePublicBlogChannel(banned);
  } catch (err) {
    threw = err instanceof Error && err.message === 'PUBLIC_CHANNEL_REQUIRED';
  }
  assert(threw, `${banned ?? 'undefined'} must be rejected for public blog`);
}

console.log('blog-public-channel.spec.ts: ok');

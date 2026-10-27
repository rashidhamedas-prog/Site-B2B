/**
 * npx ts-node --transpile-only src/modules/blog/blog-slug-live.spec.ts
 */
import {
  BLOG_RESTORE_SLUG_CONFLICT,
  BLOG_SLUG_LIVE_CONFLICT,
  blogArticlePath,
  softDeletedSlugHint,
} from './blog-slug-live';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(blogArticlePath('foo') === '/blog/foo', 'article path');
assert(softDeletedSlugHint({ liveExists: true, softDeletedId: 'x' }) === null, 'live blocks hint');
assert(softDeletedSlugHint({ liveExists: false, softDeletedId: null }) === null, 'no tombstone');
assert(
  /soft-deleted post abc/.test(softDeletedSlugHint({ liveExists: false, softDeletedId: 'abc' }) || ''),
  'hint mentions id',
);
assert(BLOG_SLUG_LIVE_CONFLICT.includes('تکراری'), 'live conflict fa');
assert(BLOG_RESTORE_SLUG_CONFLICT.includes('فعال'), 'restore conflict fa');
console.log('blog-slug-live.spec ok');

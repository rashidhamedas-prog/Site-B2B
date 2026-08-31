/**
 * npx ts-node --transpile-only src/modules/omnichannel/content-projection.spec.ts
 */
import { buildBlogProjection, buildCmsProjection } from './content-projection';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const retailBlog = buildBlogProjection({
  id: 'b1',
  slug: 'linen-care',
  title: 'مراقبت لینن',
  excerpt: 'خلاصه',
  status: 'PUBLISHED',
  channel: 'RETAIL',
}, 'RETAIL');
assert(retailBlog.publishable, 'published retail blog');
assert(retailBlog.url.includes('poshaktaranom.ir/blog/linen-care'), 'retail blog url');
assert(!buildBlogProjection({ ...retailBlog, status: 'DRAFT', id: 'b1', slug: 'x', channel: 'RETAIL' }, 'RETAIL').publishable, 'draft hidden');
assert(
  buildBlogProjection({ id: 'b1', slug: 'x', title: 't', status: 'PUBLISHED', channel: 'RETAIL' }, 'WHOLESALE').rejectReason === 'channel_mismatch',
  'no cross-channel blog',
);

const page = buildCmsProjection({
  id: 'c1',
  slug: 'about',
  title: 'درباره',
  content: 'متن',
  status: 'PUBLISHED',
  channel: 'WHOLESALE',
  kind: 'PAGE',
}, 'WHOLESALE');
assert(page.publishable && page.url.includes('poshaktaranom.com/about'), 'cms page url');
assert(
  buildCmsProjection({ id: 'c1', slug: 'hero', title: 'b', status: 'PUBLISHED', channel: 'WHOLESALE', kind: 'BANNER' }, 'WHOLESALE').rejectReason === 'kind_not_page',
  'banner not publishable',
);

console.log('content-projection.spec.ts: ok');

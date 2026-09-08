import { cmsCacheTags, storefrontPathsForCms } from './revalidate-storefront';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(storefrontPathsForCms('WHOLESALE', 'home')[0] === '/', 'wholesale home');
assert(storefrontPathsForCms('RETAIL', 'home')[0] === '/retail', 'retail home');
assert(storefrontPathsForCms('WHOLESALE', 'chrome')[0] === '/', 'wholesale chrome');
assert(storefrontPathsForCms('RETAIL', '*').includes('/retail/contact'), 'retail wildcard paths');
assert(cmsCacheTags('RETAIL', 'home').includes('cms:RETAIL:home'), 'tag');
assert(cmsCacheTags('WHOLESALE', 'home').includes('catalog:WHOLESALE'), 'catalog tag');
assert(!cmsCacheTags('WHOLESALE', 'home').includes('cms'), 'no global cms tag');
assert(!cmsCacheTags('WHOLESALE', 'contact').includes('catalog:WHOLESALE'), 'no unrelated catalog tag');
assert(cmsCacheTags('WHOLESALE', '*').includes('cms:WHOLESALE:contact'), 'wildcard tags');

console.log('revalidate-storefront.ts ok');

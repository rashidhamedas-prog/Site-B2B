import { cmsCacheTags, storefrontPathsForCms } from './revalidate-storefront';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(storefrontPathsForCms('WHOLESALE', 'home')[0] === '/', 'wholesale home');
assert(storefrontPathsForCms('RETAIL', 'home')[0] === '/retail', 'retail home');
assert(storefrontPathsForCms('WHOLESALE', 'chrome')[0] === '/', 'wholesale chrome');
assert(cmsCacheTags('RETAIL', 'home').includes('cms:RETAIL:home'), 'tag');
assert(cmsCacheTags('WHOLESALE', 'home').includes('catalog:WHOLESALE'), 'catalog tag');

console.log('revalidate-storefront.ts ok');

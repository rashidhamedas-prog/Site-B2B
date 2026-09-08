import { allRevalidatePathsForCms, cmsCacheTags, publicStorefrontPathsForCms, storefrontPathsForCms, warmPathsForCms } from './revalidate-storefront';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(storefrontPathsForCms('WHOLESALE', 'home')[0] === '/', 'wholesale home');
assert(storefrontPathsForCms('RETAIL', 'home')[0] === '/retail', 'retail app home');
assert(publicStorefrontPathsForCms('RETAIL', 'home')[0] === '/', 'retail public home');
assert(publicStorefrontPathsForCms('WHOLESALE', 'home').length === 0, 'wholesale has no public alias');
assert(allRevalidatePathsForCms('RETAIL', 'home').includes('/retail'), 'retail all has app');
assert(allRevalidatePathsForCms('RETAIL', 'home').includes('/'), 'retail all has public');
assert(allRevalidatePathsForCms('RETAIL', 'products').includes('/products'), 'retail products public');
assert(warmPathsForCms('RETAIL', 'home')[0] === '/retail', 'warm app path');
assert(cmsCacheTags('RETAIL', 'home').includes('cms:RETAIL:home'), 'tag');
assert(cmsCacheTags('WHOLESALE', 'chrome').includes('cms:WHOLESALE:home'), 'chrome tags home');

console.log('revalidate-storefront.ts ok');

import { catalogHydrationKey, isLeadCatalogImage } from './catalog-performance';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const ssrKey = catalogHydrationKey(false, '{}');
const hydratedUnfilteredKey = catalogHydrationKey(false, '{}');
assert(ssrKey === 'default', 'SSR unfiltered listing must use the default key');
assert(hydratedUnfilteredKey === ssrKey, 'unfiltered hydration must not remount the catalog');
assert(
  catalogHydrationKey(true, '{"fabric":"linen"}') === '{"fabric":"linen"}',
  'filtered listings must key by serialized parameters'
);

assert(isLeadCatalogImage({ index: 0 }), 'first image on a full catalog must be prioritized');
assert(!isLeadCatalogImage({ index: 1 }), 'only one catalog image may be prioritized');
assert(
  !isLeadCatalogImage({ index: 0, embedded: true }),
  'home/embedded rails must not claim LCP priority'
);
assert(!isLeadCatalogImage({ index: 0, page: 2 }), 'later pages must remain lazy');

console.log('catalog-performance.spec.ts: ok');

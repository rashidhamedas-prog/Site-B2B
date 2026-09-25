import assert from 'node:assert/strict';
import test from 'node:test';
import { STOREFRONT_HTML_CACHE_CONTROL } from './storefront-html-cache';

test('storefront HTML cache keeps short freshness and long SWR for CWV TTFB', () => {
  assert.equal(
    STOREFRONT_HTML_CACHE_CONTROL,
    'public, s-maxage=60, stale-while-revalidate=86400',
  );
  assert.match(STOREFRONT_HTML_CACHE_CONTROL, /s-maxage=60/);
  assert.match(STOREFRONT_HTML_CACHE_CONTROL, /stale-while-revalidate=86400/);
});

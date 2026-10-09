import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STOREFRONT_HTML_CACHE_CONTROL,
  STOREFRONT_HTML_CDN_CACHE_CONTROL,
} from './storefront-html-cache';

test('storefront HTML cache keeps short freshness and long SWR for CWV TTFB', () => {
  assert.equal(
    STOREFRONT_HTML_CACHE_CONTROL,
    'public, s-maxage=60, stale-while-revalidate=86400',
  );
  assert.match(STOREFRONT_HTML_CACHE_CONTROL, /s-maxage=60/);
  assert.match(STOREFRONT_HTML_CACHE_CONTROL, /stale-while-revalidate=86400/);
});

test('Cloudflare CDN-Cache-Control mirrors 60s freshness + long SWR', () => {
  assert.equal(
    STOREFRONT_HTML_CDN_CACHE_CONTROL,
    'public, max-age=60, stale-while-revalidate=86400',
  );
});

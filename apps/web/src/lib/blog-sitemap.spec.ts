/**
 * npx ts-node --transpile-only src/lib/blog-sitemap.spec.ts
 */
import assert from 'node:assert/strict';
import { mergeSitemapPosts } from './blog-sitemap';

const merged = mergeSitemapPosts(
  [{ slug: 'summer-manto-trends-1405', robotsIndex: true }],
  [
    { slug: 'summer-manto-trends-1405', robotsIndex: true },
    { slug: 'jacket-fabric-guide', robotsIndex: true },
    { slug: 'best-womens-fall-clothes-1405', robotsIndex: true },
    { slug: 'draft-hidden', robotsIndex: false },
    { slug: '', robotsIndex: true },
  ],
);

assert.deepEqual(
  merged.map((row) => row.slug).sort(),
  ['best-womens-fall-clothes-1405', 'jacket-fabric-guide', 'summer-manto-trends-1405'],
);

console.log('blog-sitemap.spec.ts ok');

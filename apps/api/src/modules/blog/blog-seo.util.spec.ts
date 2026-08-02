/**
 * Pure unit checks for blog SEO helpers (no Nest / jest).
 * Run: npx ts-node --transpile-only src/modules/blog/blog-seo.util.spec.ts
 */

import {
  buildRobotsMeta,
  resolveCanonicalUrl,
  countWords,
  estimateReadingMinutes,
  wouldCreateRedirectLoop,
  buildArticleJsonLd,
  buildFaqJsonLd,
  buildBreadcrumbJsonLd,
} from './blog-seo.util';
import { resolveBlogRole, hasBlogPermission } from './blog-roles';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(
  buildRobotsMeta({ robotsIndex: true, robotsFollow: true, maxImagePreview: 'large' }) ===
    'index,follow,max-image-preview:large',
  'robots meta',
);
assert(buildRobotsMeta({ robotsIndex: false, robotsFollow: true }) === 'noindex,follow', 'noindex');

assert(
  resolveCanonicalUrl({
    canonicalType: 'SELF',
    siteOrigin: 'https://poshaktaranom.ir',
    path: '/blog/autumn-manto',
  }) === 'https://poshaktaranom.ir/blog/autumn-manto',
  'canonical self',
);
assert(
  resolveCanonicalUrl({ canonicalType: 'NONE', siteOrigin: 'https://x.com', path: '/a' }) === null,
  'canonical none',
);

assert(countWords('یک دو سه چهار') === 4, 'word count');
assert(estimateReadingMinutes(360) === 2, 'reading time');

assert(
  wouldCreateRedirectLoop(
    [{ sourcePath: '/blog/b', destinationUrl: '/blog/a' }],
    '/blog/a',
    '/blog/b',
    'https://poshaktaranom.com',
  ) === true,
  'redirect loop',
);
assert(
  wouldCreateRedirectLoop([], '/blog/old', '/blog/new', 'https://poshaktaranom.com') === false,
  'redirect ok',
);

const article = buildArticleJsonLd({
  title: 'تست',
  url: 'https://poshaktaranom.ir/blog/t',
  publisherName: 'ترنم',
  publisherUrl: 'https://poshaktaranom.ir',
  logoUrl: 'https://poshaktaranom.ir/logo.png',
  authorName: 'نویسنده',
  datePublished: '2026-01-01',
});
assert(article['@type'] === 'BlogPosting', 'article type');
assert(article.headline === 'تست', 'article title');

const faq = buildFaqJsonLd([
  { question: 'سوال؟', answer: 'جواب', isVisible: true, includeInSchema: true },
]);
assert(faq?.['@type'] === 'FAQPage', 'faq schema');

const crumbs = buildBreadcrumbJsonLd([
  { name: 'خانه', url: 'https://x.com/' },
  { name: 'وبلاگ', url: 'https://x.com/blog' },
]);
assert(crumbs.itemListElement.length === 2, 'breadcrumb');

assert(resolveBlogRole({ role: 'ADMIN', blogRole: null }) === 'SUPER_ADMIN', 'default super');
assert(hasBlogPermission({ role: 'ADMIN' }, 'blog:delete_hard') === true, 'admin hard delete');
assert(hasBlogPermission({ role: 'ADMIN', blogRole: 'VIEWER' }, 'blog:publish') === false, 'viewer no publish');
assert(hasBlogPermission({ role: 'ADMIN', blogRole: 'AUTHOR' }, 'blog:create') === true, 'author create');

console.log('blog-seo.util.spec.ts: all assertions passed');

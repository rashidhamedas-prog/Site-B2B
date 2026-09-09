/**
 * Pure unit checks for PDP guide-card excerpt/image resolution.
 * Run: npx ts-node --transpile-only src/modules/product/internal-link-card.spec.ts
 */

import {
  applyGuideOverrides,
  firstImage,
  plainExcerpt,
  resolveInternalLinkCard,
  sanitizeGuideImageUrl,
} from './internal-link-card';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

let passed = 0;
function check(msg: string) {
  passed += 1;
  console.log(`  ok - ${msg}`);
}

assert(plainExcerpt(null) === null, 'empty excerpt');
assert(plainExcerpt('<p>سلام &nbsp; دنیا</p>') === 'سلام دنیا', 'strips html');
assert(plainExcerpt('الف'.repeat(200))?.endsWith('…') === true, 'truncates long text');
assert((plainExcerpt('الف'.repeat(200))?.length || 0) <= 141, 'truncation stays near max');
check('plainExcerpt');

assert(firstImage('', '  ', '/img.jpg') === '/img.jpg', 'first non-empty image');
assert(firstImage(undefined, null) === null, 'no image');
check('firstImage');

const productCard = resolveInternalLinkCard({
  channel: 'WHOLESALE',
  fallbackTitle: 'fallback',
  product: {
    images: ['/p.jpg'],
    description: 'توضیح محصول',
    seoMeta: { wholesaleDescription: 'خلاصه عمده' },
  },
});
assert(productCard.imageUrl === '/p.jpg', 'product image');
assert(productCard.excerpt === 'خلاصه عمده', 'wholesale product excerpt prefers channel seo');
check('product wholesale card');

const retailProduct = resolveInternalLinkCard({
  channel: 'RETAIL',
  product: {
    images: [],
    description: 'توضیح محصول',
    seoMeta: { retailDescription: 'خلاصه تکی', wholesaleDescription: 'عمده' },
  },
});
assert(retailProduct.imageUrl === null, 'missing product image');
assert(retailProduct.excerpt === 'خلاصه تکی', 'retail product excerpt');
check('product retail card');

const categoryCard = resolveInternalLinkCard({
  channel: 'WHOLESALE',
  category: {
    bannerUrl: '/banner.jpg',
    wholesaleIntroText: 'راهنمای خرید عمده شومیز',
  },
});
assert(categoryCard.imageUrl === '/banner.jpg', 'category banner');
assert(categoryCard.excerpt === 'راهنمای خرید عمده شومیز', 'category wholesale intro');
check('category card');

const blogCard = resolveInternalLinkCard({
  channel: 'RETAIL',
  fallbackTitle: 'عنوان لینک',
  blog: { coverImage: '/cover.jpg', excerpt: 'چکیده مطلب' },
});
assert(blogCard.imageUrl === '/cover.jpg', 'blog cover');
assert(blogCard.excerpt === 'چکیده مطلب', 'blog excerpt');
check('blog card');

const customCard = resolveInternalLinkCard({
  channel: 'WHOLESALE',
  fallbackTitle: 'صفحه سفارشی',
});
assert(customCard.imageUrl === null, 'custom has no image');
assert(customCard.excerpt === 'صفحه سفارشی', 'custom uses title fallback');
check('custom fallback');

assert(sanitizeGuideImageUrl('/uploads/a.jpg') === '/uploads/a.jpg', 'relative upload');
assert(sanitizeGuideImageUrl('/media/products/a.webp') === '/media/products/a.webp', 'relative media');
assert(
  sanitizeGuideImageUrl('https://poshaktaranom.com/uploads/a.jpg') ===
    'https://poshaktaranom.com/uploads/a.jpg',
  'wholesale host',
);
assert(
  sanitizeGuideImageUrl('https://storage.poshaktaranom.com/products/a.webp') ===
    'https://storage.poshaktaranom.com/products/a.webp',
  'storage host',
);
assert(sanitizeGuideImageUrl('javascript:alert(1)') === null, 'javascript rejected');
assert(sanitizeGuideImageUrl('https://evil.example/x.jpg') === null, 'external host rejected');
assert(sanitizeGuideImageUrl('//cdn.example/x.jpg') === null, 'protocol-relative rejected');
assert(sanitizeGuideImageUrl('/uploads/../secret') === null, 'traversal rejected');
check('sanitizeGuideImageUrl');

const merged = applyGuideOverrides(
  { imageUrl: '/p.jpg', excerpt: 'از هدف' },
  { imageUrl: '/uploads/override.jpg', excerpt: 'توضیح ادمین' },
);
assert(merged.imageUrl === '/uploads/override.jpg', 'override image wins');
assert(merged.excerpt === 'توضیح ادمین', 'override excerpt wins');
const fallback = applyGuideOverrides(
  { imageUrl: '/p.jpg', excerpt: 'از هدف' },
  { imageUrl: 'https://evil.example/x.jpg', excerpt: '' },
);
assert(fallback.imageUrl === '/p.jpg', 'bad override falls back to target');
assert(fallback.excerpt === 'از هدف', 'empty excerpt falls back');
check('applyGuideOverrides');

console.log(`internal-link-card.spec: ${passed} groups passed`);

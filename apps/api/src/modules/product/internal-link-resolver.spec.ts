/**
 * Pure unit checks for the product internal-link resolver (no Nest / jest).
 * Run: npx ts-node --transpile-only src/modules/product/internal-link-resolver.spec.ts
 *
 * NOTE: not yet wired into `npm run test` because apps/api/package.json is
 * claimed by TASK-20260905-003 (append-only test script). Append this spec
 * line to the test script when that claim is released.
 */

import {
  MAX_INTERNAL_LINKS_PER_CHANNEL,
  ANCHOR_MAX,
  buildInternalLinkUrl,
  dedupKey,
  isInternalUrl,
  normalizeInternalLinkInput,
  normalizeRel,
  toRelativePath,
  validateInternalLinkList,
} from './internal-link-resolver';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

let passed = 0;
function check(msg: string) {
  passed += 1;
  console.log(`  ok - ${msg}`);
}

// ── buildInternalLinkUrl ────────────────────────────────────
assert(buildInternalLinkUrl('PRODUCT', 'linen-sara') === '/products/linen-sara', 'product url');
assert(buildInternalLinkUrl('CATEGORY', 'shomiz') === '/category/shomiz', 'category url');
assert(buildInternalLinkUrl('BLOG', 'fall-trends') === '/blog/fall-trends', 'blog url');
assert(buildInternalLinkUrl('CUSTOM', null, '/category/shomiz') === '/category/shomiz', 'custom url');
assert(buildInternalLinkUrl('PRODUCT', null) === null, 'product url without slug');
check('buildInternalLinkUrl');

// ── normalizeRel ─────────────────────────────────────────────
assert(normalizeRel('dofollow') === 'dofollow', 'rel dofollow');
assert(normalizeRel('nofollow') === 'nofollow', 'rel nofollow');
assert(normalizeRel('sponsored') === 'sponsored', 'rel sponsored');
assert(normalizeRel(undefined) === 'dofollow', 'rel default');
assert(normalizeRel('garbage') === 'dofollow', 'rel invalid -> default');
check('normalizeRel');

// ── normalizeInternalLinkInput ──────────────────────────────
const ok = normalizeInternalLinkInput({
  targetType: 'PRODUCT',
  targetId: 'abc',
  targetUrl: '/products/x',
  anchorText: 'خرید مانتو لینن',
  rel: 'dofollow',
  sortOrder: 2,
});
assert(ok !== null, 'normalize ok');
assert(ok?.targetType === 'PRODUCT', 'normalize targetType');
assert(ok?.sortOrder === 2, 'normalize sortOrder');
assert(ok?.rel === 'dofollow', 'normalize rel');
assert(normalizeInternalLinkInput({ targetType: 'PRODUCT', targetUrl: '/p', anchorText: '' }) !== null, 'normalize accepts empty anchor (validate flags it)');
assert(
  normalizeInternalLinkInput({ targetType: 'PRODUCT', targetUrl: '/p', anchorText: 'x'.repeat(ANCHOR_MAX + 1) }) !== null,
  'normalize accepts too-long anchor (validate flags it)',
);
assert(normalizeInternalLinkInput({ targetType: 'WRONG', targetUrl: '/p', anchorText: 'x' }) === null, 'invalid targetType rejected');
assert(normalizeInternalLinkInput({ targetType: 'PRODUCT', targetUrl: '', anchorText: 'x' }) === null, 'empty url rejected');
check('normalizeInternalLinkInput');

// ── isInternalUrl / toRelativePath ─────────────────────────
assert(isInternalUrl('/category/shomiz'), 'relative internal');
assert(isInternalUrl('https://poshaktaranom.ir/category/shomiz'), 'retail host internal');
assert(isInternalUrl('https://www.poshaktaranom.com/products/x'), 'wholesale host internal');
assert(!isInternalUrl('https://example.com/x'), 'external rejected');
assert(!isInternalUrl(''), 'empty rejected');
assert(toRelativePath('https://poshaktaranom.ir/category/shomiz?x=1') === '/category/shomiz', 'toRelativePath strips host+query');
check('isInternalUrl / toRelativePath');

// ── dedupKey ────────────────────────────────────────────────
assert(
  dedupKey({ targetType: 'PRODUCT', targetId: 'a', targetUrl: '/p' }) ===
    dedupKey({ targetType: 'PRODUCT', targetId: 'a', targetUrl: '/p' }),
  'dedupKey equal',
);
check('dedupKey');

// ── validateInternalLinkList ────────────────────────────────
const selfId = 'self-uuid';
const good: Array<Record<string, unknown>> = [
  { targetType: 'PRODUCT', targetId: 'other-1', targetUrl: '/products/other-1', anchorText: 'مانتو دیگر' },
  { targetType: 'CATEGORY', targetId: 'cat-1', targetUrl: '/category/shomiz', anchorText: 'شومیز زنانه' },
];
const r1 = validateInternalLinkList(good, selfId);
assert(r1.ok.length === 2 && r1.issues.length === 0, 'two good links accepted');
check('validate accepts good links');

const dup = [
  { targetType: 'PRODUCT', targetId: 'x', targetUrl: '/products/x', anchorText: 'a' },
  { targetType: 'PRODUCT', targetId: 'x', targetUrl: '/products/x', anchorText: 'a' },
];
const r2 = validateInternalLinkList(dup, null);
assert(r2.ok.length === 1 && r2.issues.some((i) => i.reason === 'duplicate'), 'duplicate rejected');
check('validate rejects duplicate');

const selfLink = [
  { targetType: 'PRODUCT', targetId: selfId, targetUrl: '/products/self', anchorText: 'a' },
];
const r3 = validateInternalLinkList(selfLink, selfId);
assert(r3.ok.length === 0 && r3.issues.some((i) => i.reason === 'self_link'), 'self link rejected');
check('validate rejects self link');

const externalCustom = [
  { targetType: 'CUSTOM', targetId: null, targetUrl: 'https://example.com/x', anchorText: 'a' },
];
const r4 = validateInternalLinkList(externalCustom, null);
assert(r4.ok.length === 0 && r4.issues.some((i) => i.reason === 'custom_not_internal'), 'external custom rejected');
check('validate rejects external custom');

const internalCustom = [
  { targetType: 'CUSTOM', targetId: null, targetUrl: '/category/shomiz', anchorText: 'شومیز' },
];
const r5 = validateInternalLinkList(internalCustom, null);
assert(r5.ok.length === 1 && r5.issues.length === 0, 'internal custom accepted');
check('validate accepts internal custom');

const tooMany = Array.from({ length: MAX_INTERNAL_LINKS_PER_CHANNEL + 1 }, (_, i) => ({
  targetType: 'PRODUCT',
  targetId: `id-${i}`,
  targetUrl: `/products/id-${i}`,
  anchorText: `a-${i}`,
}));
const r6 = validateInternalLinkList(tooMany, null);
assert(r6.issues.some((i) => i.reason === 'too_many'), 'too_many flagged');
check('validate flags too_many');

const badAnchor = [
  { targetType: 'PRODUCT', targetId: 'x', targetUrl: '/products/x', anchorText: 'x'.repeat(ANCHOR_MAX + 1) },
];
const r7 = validateInternalLinkList(badAnchor, null);
assert(r7.ok.length === 0 && r7.issues.some((i) => i.reason === 'anchor_length'), 'bad anchor length rejected');
check('validate rejects bad anchor length');

console.log(`\nAll internal-link-resolver checks passed (${passed}).`);

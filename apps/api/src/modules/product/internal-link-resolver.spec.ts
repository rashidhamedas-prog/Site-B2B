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
  isUrlOnOppositeChannel,
  dedupResolvedLinks,
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
assert(ok?.imageUrl === null, 'missing image stays null');
assert(
  normalizeInternalLinkInput({
    targetType: 'PRODUCT',
    targetUrl: '/p',
    anchorText: 'x',
    imageUrl: 'javascript:alert(1)',
    excerpt: '<b>خلاصه راهنما</b>',
  })?.imageUrl === null,
  'javascript image dropped',
);
assert(
  normalizeInternalLinkInput({
    targetType: 'PRODUCT',
    targetUrl: '/p',
    anchorText: 'x',
    imageUrl: '/uploads/guide.jpg',
    excerpt: '<b>خلاصه راهنما</b>',
  })?.excerpt === 'خلاصه راهنما',
  'excerpt strips html',
);
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

// ── isUrlOnOppositeChannel (channel separation for CUSTOM) ───
assert(isUrlOnOppositeChannel('https://poshaktaranom.com/products/x', 'RETAIL') === true, 'retail link to .com host = opposite');
assert(isUrlOnOppositeChannel('https://www.poshaktaranom.com/products/x', 'RETAIL') === true, 'retail link to www .com host = opposite');
assert(isUrlOnOppositeChannel('https://poshaktaranom.ir/products/x', 'WHOLESALE') === true, 'wholesale link to .ir host = opposite');
assert(isUrlOnOppositeChannel('https://poshaktaranom.ir/products/x', 'RETAIL') === false, 'retail link to .ir host = same channel');
assert(isUrlOnOppositeChannel('https://poshaktaranom.com/products/x', 'WHOLESALE') === false, 'wholesale link to .com host = same channel');
assert(isUrlOnOppositeChannel('/products/x', 'RETAIL') === false, 'relative path = same channel');
assert(isUrlOnOppositeChannel('/products/x', 'WHOLESALE') === false, 'relative path = same channel (wholesale)');
assert(isUrlOnOppositeChannel('https://example.com/x', 'RETAIL') === false, 'external url = not opposite (handled by isInternalUrl)');
check('isUrlOnOppositeChannel');

// ── dedupResolvedLinks (post-resolution collapse → 400 not 500) ──
const collapsed = [
  { targetType: 'PRODUCT', targetId: 'same', targetUrl: '/products/same', anchorText: 'a', title: null, rel: 'dofollow', sortOrder: 0 },
  { targetType: 'PRODUCT', targetId: 'same', targetUrl: '/products/old-slug', anchorText: 'b', title: null, rel: 'dofollow', sortOrder: 1 },
].map((l) => normalizeInternalLinkInput(l)!);
const d1 = dedupResolvedLinks(collapsed);
assert(d1.ok.length === 1 && d1.duplicates.length === 1, 'post-resolution duplicate collapsed to one + one duplicate');
check('dedupResolvedLinks collapses same targetId');

const customDup = [
  { targetType: 'CUSTOM', targetId: null, targetUrl: '/category/shomiz', anchorText: 'a', title: null, rel: 'dofollow', sortOrder: 0 },
  { targetType: 'CUSTOM', targetId: null, targetUrl: '  /category/shomiz  ', anchorText: 'b', title: null, rel: 'dofollow', sortOrder: 1 },
].map((l) => normalizeInternalLinkInput(l)!);
const d2 = dedupResolvedLinks(customDup);
assert(d2.ok.length === 1 && d2.duplicates.length === 1, 'custom duplicate by normalized url collapsed');
check('dedupResolvedLinks collapses custom by normalized url');

const distinct = [
  { targetType: 'PRODUCT', targetId: 'a', targetUrl: '/products/a', anchorText: 'a', title: null, rel: 'dofollow', sortOrder: 0 },
  { targetType: 'PRODUCT', targetId: 'b', targetUrl: '/products/b', anchorText: 'b', title: null, rel: 'dofollow', sortOrder: 1 },
].map((l) => normalizeInternalLinkInput(l)!);
const d3 = dedupResolvedLinks(distinct);
assert(d3.ok.length === 2 && d3.duplicates.length === 0, 'distinct targets kept');
check('dedupResolvedLinks keeps distinct targets');

console.log(`\nAll internal-link-resolver checks passed (${passed}).`);

// ── Regression: update() must NOT pass retailInternalLinks / ──────────
// wholesaleInternalLinks / relatedProductIds to the repo update() call. ─
// These keys live on the DTO, not on ProductEntity; spreading the DTO into
// the patch and calling repo.update() used to throw
// `EntityPropertyNotFoundError: Property "retailInternalLinks" was not found`.
// We construct ProductService with stub repos, throw a sentinel from inside
// the transaction's em.update to capture the patch and short-circuit the
// post-transaction side-effects, then assert the forbidden keys are absent.
(async () => {
  const { ProductService } = await import('./product.service');
  const SENTINEL = Symbol('patch-spread-sentinel');
  let capturedPatch: Record<string, unknown> | null = null;

  const existing = {
    id: 'p1',
    slug: 'old-slug',
    status: 'ACTIVE',
    showOnRetail: true,
    showOnWholesale: true,
    wholesalePrice: 1000,
    retailPrice: 2000,
    images: [],
    variants: [],
    createdAt: new Date().toISOString(),
  } as any;

  const productRepoForUpdate = {
    update: (_id: string, patch: Record<string, unknown>) => {
      capturedPatch = patch;
      throw SENTINEL;
    },
  };
  const em = {
    getRepository: (Entity: { name: string }) =>
      Entity.name === 'ProductEntity' ? productRepoForUpdate : {},
  };
  const productRepo = {
    findOne: async () => existing,
    manager: { transaction: async (cb: (em: unknown) => Promise<unknown>) => cb(em) },
  };

  const service = new ProductService(
    productRepo as any,
    {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
  );

  let threwSentinel = false;
  try {
    await service.update('p1', {
      name: 'new name',
      retailInternalLinks: [
        { targetType: 'CUSTOM', targetUrl: '/category/x', anchorText: 'x' },
      ],
      wholesaleInternalLinks: [
        { targetType: 'CUSTOM', targetUrl: '/category/y', anchorText: 'y' },
      ],
      relatedProductIds: ['r1'],
    } as any);
  } catch (e) {
    if (e !== SENTINEL) throw e;
    threwSentinel = true;
  }

  assert(threwSentinel, 'update reached em.update (sentinel thrown)');
  assert(capturedPatch !== null, 'patch was captured by em.update');
  assert(!('retailInternalLinks' in (capturedPatch as object)), 'patch omits retailInternalLinks');
  assert(!('wholesaleInternalLinks' in (capturedPatch as object)), 'patch omits wholesaleInternalLinks');
  assert(!('relatedProductIds' in (capturedPatch as object)), 'patch omits relatedProductIds');
  assert((capturedPatch as any).name === 'new name', 'patch keeps real entity fields');
  console.log('  ok - update() patch strips retailInternalLinks/wholesaleInternalLinks/relatedProductIds');
  console.log('\nRegression check passed (patch-spread).');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

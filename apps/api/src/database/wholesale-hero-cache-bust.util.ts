export const WHOLESALE_HERO_ASSET_URLS = {
  oldImageUrl: '/banners/hero-product-2026-v2/wholesale-01.webp',
  oldMobileImageUrl: '/banners/hero-product-2026-v2/wholesale-01-mobile.webp',
  newImageUrl: '/banners/hero-product-2026-v2/wholesale-01-73e2bdac6948.webp',
  newMobileImageUrl: '/banners/hero-product-2026-v2/wholesale-01-mobile-8c90e6ac4182.webp',
} as const;

type AssetSwap = {
  fromImageUrl: string;
  toImageUrl: string;
  fromMobileImageUrl: string;
  toMobileImageUrl: string;
};

export type WholesaleHeroAssetChange = {
  blockIndex: number;
  slideIndex: number;
  field: 'imageUrl' | 'mobileImageUrl';
  from: string;
  to: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function planWholesaleHeroAssetSwaps(
  blocks: unknown,
  swap: AssetSwap
): WholesaleHeroAssetChange[] {
  if (!Array.isArray(blocks)) return [];
  const changes: WholesaleHeroAssetChange[] = [];

  blocks.forEach((block, blockIndex) => {
    if (!isRecord(block) || block.type !== 'hero' || !isRecord(block.props)) return;
    const slides = block.props.slides;
    if (!Array.isArray(slides)) return;
    slides.forEach((slide, slideIndex) => {
      if (!isRecord(slide)) return;
      if (slide.imageUrl === swap.fromImageUrl) {
        changes.push({
          blockIndex,
          slideIndex,
          field: 'imageUrl',
          from: swap.fromImageUrl,
          to: swap.toImageUrl,
        });
      }
      if (slide.mobileImageUrl === swap.fromMobileImageUrl) {
        changes.push({
          blockIndex,
          slideIndex,
          field: 'mobileImageUrl',
          from: swap.fromMobileImageUrl,
          to: swap.toMobileImageUrl,
        });
      }
    });
  });

  return changes;
}

/**
 * Apply only recorded field-level hero URL changes. Admin copy, settings,
 * ordering, and URLs that were already hashed stay untouched.
 */
export function applyWholesaleHeroAssetChanges(
  blocks: unknown,
  changes: WholesaleHeroAssetChange[],
  direction: 'forward' | 'reverse' = 'forward'
): { blocks: unknown; changed: boolean } {
  if (!Array.isArray(blocks) || changes.length === 0) {
    return { blocks, changed: false };
  }

  const nextBlocks = blocks.map((block) =>
    isRecord(block) && isRecord(block.props) && Array.isArray(block.props.slides)
      ? { ...block, props: { ...block.props, slides: [...block.props.slides] } }
      : block,
  );
  let changed = false;

  for (const change of changes) {
    const block = nextBlocks[change.blockIndex];
    if (!isRecord(block) || !isRecord(block.props) || !Array.isArray(block.props.slides)) continue;
    const slide = block.props.slides[change.slideIndex];
    if (!isRecord(slide)) continue;
    const expected = direction === 'forward' ? change.from : change.to;
    const desired = direction === 'forward' ? change.to : change.from;
    if (slide[change.field] === desired) continue;
    if (slide[change.field] !== expected) continue;
    block.props.slides[change.slideIndex] = { ...slide, [change.field]: desired };
    changed = true;
  }

  return { blocks: changed ? nextBlocks : blocks, changed };
}

export function swapWholesaleHeroAssetUrls(
  blocks: unknown,
  swap: AssetSwap
): { blocks: unknown; changed: boolean } {
  return applyWholesaleHeroAssetChanges(blocks, planWholesaleHeroAssetSwaps(blocks, swap), 'forward');
}

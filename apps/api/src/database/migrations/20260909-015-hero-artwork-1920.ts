import { MigrationInterface, QueryRunner } from 'typeorm';
import { applyRetailCampaignHeroSlidesToBlocks } from '../retail-campaign-hero.util';
import { applyWholesalePromoHeroSlidesToBlocks } from '../wholesale-promo-hero.util';

const PRODUCT_HERO_REMAP: Record<string, string> = {
  '/banners/hero-product-2026-v2/retail-01.webp':
    '/banners/hero-product-2026-v2/retail-01-bdf633c73bdb.webp',
  '/banners/hero-product-2026-v2/retail-01-mobile.webp':
    '/banners/hero-product-2026-v2/retail-01-mobile-51f0d337d1ae.webp',
  '/banners/hero-product-2026-v2/retail-02-behgol.webp':
    '/banners/hero-product-2026-v2/retail-02-behgol-a99083b686a5.webp',
  '/banners/hero-product-2026-v2/retail-02-behgol-mobile.webp':
    '/banners/hero-product-2026-v2/retail-02-behgol-mobile-2839c8509671.webp',
  '/banners/hero-product-2026-v2/retail-03-alice.webp':
    '/banners/hero-product-2026-v2/retail-03-alice-a6cbf5dd4f92.webp',
  '/banners/hero-product-2026-v2/retail-03-alice-mobile.webp':
    '/banners/hero-product-2026-v2/retail-03-alice-mobile-209b592f0fda.webp',
  '/banners/hero-product-2026-v2/wholesale-01.webp':
    '/banners/hero-product-2026-v2/wholesale-01-77cddaaa7fb7.webp',
  '/banners/hero-product-2026-v2/wholesale-01-73e2bdac6948.webp':
    '/banners/hero-product-2026-v2/wholesale-01-77cddaaa7fb7.webp',
  '/banners/hero-product-2026-v2/wholesale-01-mobile.webp':
    '/banners/hero-product-2026-v2/wholesale-01-mobile-eac642cb4ad0.webp',
  '/banners/hero-product-2026-v2/wholesale-01-mobile-8c90e6ac4182.webp':
    '/banners/hero-product-2026-v2/wholesale-01-mobile-eac642cb4ad0.webp',
  '/banners/hero-product-2026-v2/wholesale-02.webp':
    '/banners/hero-product-2026-v2/wholesale-02-5ef4e725ea3a.webp',
  '/banners/hero-product-2026-v2/wholesale-02-mobile.webp':
    '/banners/hero-product-2026-v2/wholesale-02-mobile-362aa5129ba6.webp',
  '/banners/hero-product-2026-v2/wholesale-03.webp':
    '/banners/hero-product-2026-v2/wholesale-03-e2c9b72fb875.webp',
  '/banners/hero-product-2026-v2/wholesale-03-mobile.webp':
    '/banners/hero-product-2026-v2/wholesale-03-mobile-33492b31461f.webp',
};

function remapProductHeroUrls(blocks: unknown): { blocks: unknown; changed: boolean } {
  if (!Array.isArray(blocks)) return { blocks, changed: false };
  let changed = false;
  const next = blocks.map((block) => {
    if (!block || typeof block !== 'object') return block;
    const hero = block as { type?: unknown; props?: Record<string, unknown> | null };
    if (hero.type !== 'hero' || !hero.props || typeof hero.props !== 'object') return block;
    const slides = Array.isArray(hero.props.slides) ? hero.props.slides : null;
    if (!slides) return block;
    let slidesChanged = false;
    const mapped = slides.map((slide) => {
      if (!slide || typeof slide !== 'object') return slide;
      const row = slide as { imageUrl?: unknown; mobileImageUrl?: unknown };
      const imageUrl =
        typeof row.imageUrl === 'string' ? PRODUCT_HERO_REMAP[row.imageUrl] : undefined;
      const mobileImageUrl =
        typeof row.mobileImageUrl === 'string'
          ? PRODUCT_HERO_REMAP[row.mobileImageUrl]
          : undefined;
      if (!imageUrl && !mobileImageUrl) return slide;
      slidesChanged = true;
      return {
        ...row,
        ...(imageUrl ? { imageUrl } : {}),
        ...(mobileImageUrl ? { mobileImageUrl } : {}),
      };
    });
    if (!slidesChanged) return block;
    changed = true;
    return { ...hero, props: { ...hero.props, slides: mapped } };
  });
  return { blocks: next, changed };
}

export class HeroArtwork1920Quality1757430000015 implements MigrationInterface {
  name = 'HeroArtwork1920Quality1757430000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.patch(queryRunner, 'RETAIL', applyRetailCampaignHeroSlidesToBlocks);
    await this.patch(queryRunner, 'WHOLESALE', applyWholesalePromoHeroSlidesToBlocks);
  }

  public async down(): Promise<void> {
    // New hashed 1920×560 plates stay; previous migrations keep their own backups.
  }

  private async patch(
    queryRunner: QueryRunner,
    channel: 'RETAIL' | 'WHOLESALE',
    apply: (blocks: unknown) => { blocks: unknown; changed: boolean },
  ): Promise<void> {
    const rows: Array<{ blocks: unknown }> = await queryRunner.query(
      `SELECT "blocks" FROM "site_contents" WHERE "channel" = $1 AND "pageKey" = 'home' LIMIT 1`,
      [channel],
    );
    if (!rows[0]) return;

    const campaign = apply(rows[0].blocks);
    const remapped = remapProductHeroUrls(campaign.blocks);
    if (!campaign.changed && !remapped.changed) return;

    await queryRunner.query(
      `UPDATE "site_contents" SET "blocks" = $1::jsonb, "updatedAt" = now() WHERE "channel" = $2 AND "pageKey" = 'home'`,
      [JSON.stringify(remapped.blocks), channel],
    );
  }
}

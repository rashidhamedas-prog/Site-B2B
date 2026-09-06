import { MigrationInterface, QueryRunner } from 'typeorm';

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

export class WholesaleHeroCacheBust1757151000004 implements MigrationInterface {
  name = 'WholesaleHeroCacheBust1757151000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wholesale_hero_asset_backups" (
        "siteContentId" uuid PRIMARY KEY,
        "changes" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    const rows: Array<{ id: string; blocks: unknown }> = await queryRunner.query(`
        SELECT "id", "blocks"
        FROM "site_contents"
        WHERE "channel" = 'WHOLESALE' AND "pageKey" = 'home'
      `);

    for (const row of rows) {
      const changes = planWholesaleHeroAssetSwaps(row.blocks, {
        fromImageUrl: WHOLESALE_HERO_ASSET_URLS.oldImageUrl,
        toImageUrl: WHOLESALE_HERO_ASSET_URLS.newImageUrl,
        fromMobileImageUrl: WHOLESALE_HERO_ASSET_URLS.oldMobileImageUrl,
        toMobileImageUrl: WHOLESALE_HERO_ASSET_URLS.newMobileImageUrl,
      });
      const patched = applyWholesaleHeroAssetChanges(row.blocks, changes, 'forward');
      if (!patched.changed) continue;

      await queryRunner.query(
        `
          INSERT INTO "wholesale_hero_asset_backups" (
            "siteContentId",
            "changes"
          )
          VALUES ($1, $2::jsonb)
          ON CONFLICT ("siteContentId") DO NOTHING
        `,
        [row.id, JSON.stringify(changes)]
      );
      await queryRunner.query(
        `
          UPDATE "site_contents"
          SET "blocks" = $1::jsonb, "updatedAt" = now()
          WHERE "id" = $2
        `,
        [JSON.stringify(patched.blocks), row.id]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{
      id: string;
      blocks: unknown;
      changes: WholesaleHeroAssetChange[];
    }> = await queryRunner.query(`
      SELECT
        sc."id",
        sc."blocks",
        backup."changes"
      FROM "site_contents" sc
      INNER JOIN "wholesale_hero_asset_backups" backup
        ON backup."siteContentId" = sc."id"
      WHERE sc."channel" = 'WHOLESALE' AND sc."pageKey" = 'home'
    `);

    for (const row of rows) {
      const patched = applyWholesaleHeroAssetChanges(row.blocks, row.changes, 'reverse');
      if (!patched.changed) continue;
      await queryRunner.query(
        `
          UPDATE "site_contents"
          SET "blocks" = $1::jsonb, "updatedAt" = now()
          WHERE "id" = $2
        `,
        [JSON.stringify(patched.blocks), row.id]
      );
    }

    await queryRunner.query(`DROP TABLE IF EXISTS "wholesale_hero_asset_backups"`);
  }
}

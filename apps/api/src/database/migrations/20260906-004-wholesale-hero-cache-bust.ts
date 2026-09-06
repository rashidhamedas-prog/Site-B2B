import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  WHOLESALE_HERO_ASSET_URLS,
  applyWholesaleHeroAssetChanges,
  planWholesaleHeroAssetSwaps,
  type WholesaleHeroAssetChange,
} from '../wholesale-hero-cache-bust.util';

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

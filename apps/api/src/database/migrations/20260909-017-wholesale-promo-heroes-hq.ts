import { MigrationInterface, QueryRunner } from 'typeorm';
import { applyWholesalePromoHeroSlidesToBlocks } from '../wholesale-promo-hero.util';

export class WholesalePromoHeroesHq1757430000017 implements MigrationInterface {
  name = 'WholesalePromoHeroesHq1757430000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "site_content_wholesale_promo_hq_backups" (
        "channel" varchar NOT NULL,
        "pageKey" varchar NOT NULL,
        "heroProps" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("channel", "pageKey")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "site_content_wholesale_promo_hq_backups" ("channel", "pageKey", "heroProps")
      SELECT sc."channel", sc."pageKey", block.value->'props'
      FROM "site_contents" sc
      CROSS JOIN LATERAL jsonb_array_elements(sc."blocks") AS block(value)
      WHERE sc."pageKey" = 'home'
        AND sc."channel" = 'WHOLESALE'
        AND block.value->>'type' = 'hero'
      ON CONFLICT ("channel", "pageKey") DO NOTHING
    `);

    const rows: Array<{ blocks: unknown }> = await queryRunner.query(
      `SELECT "blocks" FROM "site_contents" WHERE "channel" = 'WHOLESALE' AND "pageKey" = 'home' LIMIT 1`,
    );
    if (!rows[0]) return;

    const patched = applyWholesalePromoHeroSlidesToBlocks(rows[0].blocks);
    if (!patched.changed) return;

    await queryRunner.query(
      `UPDATE "site_contents" SET "blocks" = $1::jsonb, "updatedAt" = now() WHERE "channel" = 'WHOLESALE' AND "pageKey" = 'home'`,
      [JSON.stringify(patched.blocks)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "site_contents" sc
      SET "blocks" = (
            SELECT jsonb_agg(
              CASE WHEN block.value->>'type' = 'hero'
                THEN jsonb_set(block.value, '{props}', backup."heroProps", true)
                ELSE block.value END
              ORDER BY block.ordinality
            )
            FROM jsonb_array_elements(sc."blocks") WITH ORDINALITY AS block(value, ordinality)
          ),
          "updatedAt" = now()
      FROM "site_content_wholesale_promo_hq_backups" backup
      WHERE backup."channel" = sc."channel"
        AND backup."pageKey" = sc."pageKey"
        AND sc."channel" = 'WHOLESALE'
        AND sc."pageKey" = 'home'
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "site_content_wholesale_promo_hq_backups"`);
  }
}

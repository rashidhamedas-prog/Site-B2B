import { MigrationInterface, QueryRunner } from 'typeorm';
import { applyRetailCampaignHeroSlidesToBlocks } from '../retail-campaign-hero.util';

export class RetailCampaignHeroes1757430000013 implements MigrationInterface {
  name = 'RetailCampaignHeroes1757430000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "site_content_retail_campaign_hero_backups" (
        "channel" varchar NOT NULL,
        "pageKey" varchar NOT NULL,
        "heroProps" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("channel", "pageKey")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "site_content_retail_campaign_hero_backups" ("channel", "pageKey", "heroProps")
      SELECT sc."channel", sc."pageKey", block.value->'props'
      FROM "site_contents" sc
      CROSS JOIN LATERAL jsonb_array_elements(sc."blocks") AS block(value)
      WHERE sc."pageKey" = 'home'
        AND sc."channel" = 'RETAIL'
        AND block.value->>'type' = 'hero'
      ON CONFLICT ("channel", "pageKey") DO NOTHING
    `);

    const rows: Array<{ blocks: unknown }> = await queryRunner.query(
      `SELECT "blocks" FROM "site_contents" WHERE "channel" = 'RETAIL' AND "pageKey" = 'home' LIMIT 1`,
    );
    if (!rows[0]) return;

    const patched = applyRetailCampaignHeroSlidesToBlocks(rows[0].blocks);
    if (!patched.changed) return;

    await queryRunner.query(
      `UPDATE "site_contents" SET "blocks" = $1::jsonb, "updatedAt" = now() WHERE "channel" = 'RETAIL' AND "pageKey" = 'home'`,
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
      FROM "site_content_retail_campaign_hero_backups" backup
      WHERE backup."channel" = sc."channel"
        AND backup."pageKey" = sc."pageKey"
        AND sc."channel" = 'RETAIL'
        AND sc."pageKey" = 'home'
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "site_content_retail_campaign_hero_backups"`);
  }
}

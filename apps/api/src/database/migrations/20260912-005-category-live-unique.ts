import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Live-only unique name/slug so tombstones do not block Persian renames.
 * Also lifts RETAIL home categoryBanners maxItems 10 → 16 (legacy code default).
 * Additive / reversible when no live↔tombstone collisions exist on down.
 */
export class CategoryLiveUnique1757682000005 implements MigrationInterface {
  name = 'CategoryLiveUnique1757682000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_categories_name_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_categories_slug"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categories_name_live"
        ON "categories" ("name")
        WHERE "deletedAt" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categories_slug_live"
        ON "categories" ("slug")
        WHERE "deletedAt" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "site_contents" AS sc
      SET "blocks" = sub.blocks, "updatedAt" = now()
      FROM (
        SELECT
          sc2.id,
          (
            SELECT jsonb_agg(x.updated ORDER BY x.ord)
            FROM (
              SELECT
                CASE
                  WHEN b.elem->>'type' = 'categoryBanners'
                    AND COALESCE((b.elem->'props'->>'maxItems')::int, 0) = 10
                  THEN jsonb_set(b.elem, '{props,maxItems}', '16'::jsonb)
                  ELSE b.elem
                END AS updated,
                b.ord
              FROM jsonb_array_elements(sc2.blocks) WITH ORDINALITY AS b(elem, ord)
            ) x
          ) AS blocks
        FROM "site_contents" sc2
        WHERE sc2."pageKey" = 'home'
      ) sub
      WHERE sc.id = sub.id AND sub.blocks IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_categories_name_live"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_categories_slug_live"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_categories_name_unique"
        ON "categories" ("name")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categories_slug"
        ON "categories" ("slug")
    `);
  }
}

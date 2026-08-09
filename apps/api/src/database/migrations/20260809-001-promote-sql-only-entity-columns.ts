import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Promote SQL-only entity columns into TypeORM SoT (C4 dual-path remediation).
 *
 * These columns were previously applied only via deploy safety-net
 * (`scripts/apply-production-schema.sql`) and/or ad-hoc
 * `apps/api/src/database/sql/20260729-wholesale-color-select.sql`, while
 * entities already depend on them:
 *   - products.viewCount (+ index)
 *   - products.allowWholesaleColorSelect / minWholesaleColors
 *   - categories.bannerUrl
 *   - orders.torobClid (+ partial index)
 *
 * Idempotent expand-only DDL (ADD COLUMN / CREATE INDEX IF NOT EXISTS).
 * Does NOT mutate production data beyond schema expansion.
 * After this lands and is verified on VPS, narrow (do not delete) the safety-net.
 */
export class PromoteSqlOnlyEntityColumns1786276800001 implements MigrationInterface {
  name = 'PromoteSqlOnlyEntityColumns1786276800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // products: retail PDP view counter (most-viewed homepage sort)
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "viewCount" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_viewCount"
      ON "products" ("viewCount")
    `);

    // products: wholesale color selection for pack-matrix orders
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "allowWholesaleColorSelect" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "minWholesaleColors" integer NOT NULL DEFAULT 1
    `);

    // categories: square 1:1 banner for retail homepage grid
    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "bannerUrl" text
    `);

    // orders: Torob click id attribution
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "torobClid" varchar
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_torobClid"
      ON "orders" ("torobClid")
      WHERE "torobClid" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_torobClid"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "torobClid"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN IF EXISTS "bannerUrl"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "minWholesaleColors"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "allowWholesaleColorSelect"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_viewCount"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "viewCount"`);
  }
}

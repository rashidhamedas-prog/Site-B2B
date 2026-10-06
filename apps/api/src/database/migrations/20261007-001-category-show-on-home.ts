import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Home-grid merchandising flag only.
 * Does not change category lifecycle, menus, sitemap, or category pages.
 * Default true so existing tiles stay visible after deploy.
 */
export class CategoryShowOnHome1760092800001 implements MigrationInterface {
  name = 'CategoryShowOnHome1760092800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "showOnHome" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
      DROP COLUMN IF EXISTS "showOnHome"
    `);
  }
}

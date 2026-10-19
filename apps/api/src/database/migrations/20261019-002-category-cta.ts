import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-channel category CTA knobs (jsonb).
 * Retail → "cta", wholesale → "wholesaleCta".
 * Default NULL = disabled (no storefront CTA until admin enables).
 */
export class CategoryCta1760904000002 implements MigrationInterface {
  name = 'CategoryCta1760904000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "cta" jsonb NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "wholesaleCta" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
      DROP COLUMN IF EXISTS "wholesaleCta"
    `);
    await queryRunner.query(`
      ALTER TABLE "categories"
      DROP COLUMN IF EXISTS "cta"
    `);
  }
}

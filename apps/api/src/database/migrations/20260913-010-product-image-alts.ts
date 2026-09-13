import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-URL product image alt map. images[] stays the ordered gallery.
 * Additive / reversible. Empty object default so old rows stay valid.
 */
export class ProductImageAlts1757763600010 implements MigrationInterface {
  name = 'ProductImageAlts1757763600010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "imageAlts" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "imageAlts"
    `);
  }
}

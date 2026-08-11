import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dual-channel compare-at (before-discount) prices.
 * Final/transaction prices remain wholesalePrice / retailPrice.
 */
export class ProductCompareAtPrices1754816400001 implements MigrationInterface {
  name = 'ProductCompareAtPrices1754816400001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "retailCompareAtPrice" bigint
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "wholesaleCompareAtPrice" bigint
    `);

    // Customer channel reclassification intentionally removed from this DDL migration.
    // See CustomerChannelClassification1754827200001 (20260810-005) for snapshot-backed DML.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "wholesaleCompareAtPrice"`
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "retailCompareAtPrice"`);
  }
}

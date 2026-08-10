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

    // Canonical customer channel backfill:
    // retail OTP accounts use type=B2C + businessType=RETAIL;
    // conflicting defaults (type=B2B + businessType=RETAIL) → WHOLESALE via businessType=WHOLESALE when type is B2B.
    await queryRunner.query(`
      UPDATE customers
      SET "businessType" = 'WHOLESALE'
      WHERE UPPER(COALESCE(type, '')) = 'B2B'
        AND UPPER(COALESCE("businessType", '')) = 'RETAIL'
    `);
    await queryRunner.query(`
      UPDATE customers
      SET "businessType" = 'RETAIL', type = 'B2C'
      WHERE UPPER(COALESCE(type, '')) IN ('RETAIL', 'B2C')
        AND ( "businessType" IS NULL OR TRIM("businessType") = '' )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "wholesaleCompareAtPrice"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "retailCompareAtPrice"`);
  }
}

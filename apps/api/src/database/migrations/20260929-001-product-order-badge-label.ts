import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Free-text chip on wholesale product cards (replaces hard-coded «حداقل N عدد»).
 * Numeric minOrderQty remains the pack MOQ for cart validation.
 */
export class ProductOrderBadgeLabel1759147200001 implements MigrationInterface {
  name = 'ProductOrderBadgeLabel1759147200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "orderBadgeLabel" character varying(80)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "orderBadgeLabel"
    `);
  }
}

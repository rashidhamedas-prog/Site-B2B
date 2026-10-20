import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-product custom size chart + XOR pack definition (AUTO matrix vs MANUAL composition).
 */
export class ProductCustomSizePack1760976000001 implements MigrationInterface {
  name = 'ProductCustomSizePack1760976000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "sizeLabels" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "sizeGuideLines" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "packDefinitionMode" character varying(16) NOT NULL DEFAULT 'AUTO'
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "packComposition" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "packComposition"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "packDefinitionMode"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "sizeGuideLines"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "sizeLabels"`);
  }
}

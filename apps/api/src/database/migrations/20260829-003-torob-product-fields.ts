import { MigrationInterface, QueryRunner } from 'typeorm';

export class TorobProductFields1756473600003 implements MigrationInterface {
  name = 'TorobProductFields1756473600003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "guarantee" varchar(200)
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "defaultRetailVariantId" uuid
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_products_default_retail_variant'
        ) THEN
          ALTER TABLE "products"
          ADD CONSTRAINT "FK_products_default_retail_variant"
          FOREIGN KEY ("defaultRetailVariantId")
          REFERENCES "product_variants"("id")
          ON DELETE SET NULL;
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "FK_products_default_retail_variant"
    `);
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "defaultRetailVariantId"
    `);
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "guarantee"
    `);
  }
}

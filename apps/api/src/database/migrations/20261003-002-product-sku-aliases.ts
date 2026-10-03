import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductSkuAliases1759462800001 implements MigrationInterface {
  name = 'ProductSkuAliases1759462800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_sku_aliases" (
        "sku" varchar(191) PRIMARY KEY,
        "productId" uuid NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_sku_aliases_productId"
      ON "product_sku_aliases" ("productId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product_sku_aliases"`);
  }
}

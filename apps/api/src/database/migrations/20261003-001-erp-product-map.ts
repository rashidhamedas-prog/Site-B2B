import { MigrationInterface, QueryRunner } from 'typeorm';

export class ErpProductMap1759459200001 implements MigrationInterface {
  name = 'ErpProductMap1759459200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_product_map" (
        "erpProductSku" varchar(191) PRIMARY KEY,
        "productId" uuid NOT NULL,
        "matchedBy" varchar(32) NOT NULL DEFAULT 'barcode',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_product_map_productId"
      ON "erp_product_map" ("productId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_product_map"`);
  }
}

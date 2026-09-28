import { MigrationInterface, QueryRunner } from 'typeorm';

export class ErpInventoryMatrix1759046400001 implements MigrationInterface {
  name = 'ErpInventoryMatrix1759046400001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_variant_map" (
        "erpVariantSku" varchar(191) PRIMARY KEY,
        "productId" uuid NOT NULL,
        "variantId" uuid NOT NULL,
        "matchedBy" varchar(32) NOT NULL DEFAULT 'map',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_variant_map_productId"
      ON "erp_variant_map" ("productId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_variant_map_variantId"
      ON "erp_variant_map" ("variantId")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_inventory_idempotency" (
        "idempotencyKey" varchar(191) PRIMARY KEY,
        "response" jsonb NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_inventory_idempotency_expiresAt"
      ON "erp_inventory_idempotency" ("expiresAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_inventory_idempotency"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_variant_map"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductLevelStock20260720001 implements MigrationInterface {
  name = 'ProductLevelStock20260720001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "stock" integer NOT NULL DEFAULT 0
    `);

    // Backfill from sum of variant stocks (legacy per-color inventory).
    await queryRunner.query(`
      UPDATE "products" p
      SET "stock" = COALESCE((
        SELECT SUM(v."stock")::int FROM "product_variants" v WHERE v."productId" = p."id"
      ), 0)
      WHERE COALESCE(p."stock", 0) = 0
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ALTER COLUMN "productVariantId" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_movements"
      ADD COLUMN IF NOT EXISTS "productId" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inventory_movements" DROP COLUMN IF EXISTS "productId"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "stock"`);
  }
}

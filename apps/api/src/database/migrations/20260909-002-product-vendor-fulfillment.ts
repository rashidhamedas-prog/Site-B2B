import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductVendorFulfillment1757392800002 implements MigrationInterface {
  name = 'ProductVendorFulfillment1757392800002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "vendorId" uuid,
        ADD COLUMN IF NOT EXISTS "commissionPercent" integer,
        ADD COLUMN IF NOT EXISTS "brandName" varchar(80)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_vendorId" ON "products" ("vendorId")
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "products"
          ADD CONSTRAINT "FK_products_vendorId"
          FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "products"
          ADD CONSTRAINT "CHK_products_vendor_commission"
          CHECK (
            ("vendorId" IS NULL AND "commissionPercent" IS NULL)
            OR (
              "vendorId" IS NOT NULL
              AND "commissionPercent" IS NOT NULL
              AND "commissionPercent" >= 0
              AND "commissionPercent" <= 90
            )
          );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "CHK_products_vendor_commission"`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "FK_products_vendorId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_vendorId"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "brandName"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "commissionPercent"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "vendorId"`);
  }
}

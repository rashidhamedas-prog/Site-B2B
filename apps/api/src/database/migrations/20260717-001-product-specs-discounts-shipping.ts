import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductSpecsDiscountsShipping1784236800001 implements MigrationInterface {
  name = 'ProductSpecsDiscountsShipping1784236800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "fabric" DROP NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "fabric" SET DEFAULT '';`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "specs" jsonb;`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sizeType" varchar NOT NULL DEFAULT 'FREE';`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isDiscounted" boolean NOT NULL DEFAULT false;`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_spec_memory" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fieldKey" varchar NOT NULL,
        "value" varchar NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_spec_memory_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_product_spec_memory_field_value" UNIQUE ("fieldKey", "value")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_product_spec_memory_fieldKey" ON "product_spec_memory" ("fieldKey");`);

    await queryRunner.query(`ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP;`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tiered_discounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "levels" jsonb NOT NULL DEFAULT '[]',
        "expiresAt" TIMESTAMP,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tiered_discounts_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "side_discounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" varchar NOT NULL,
        "percent" integer NOT NULL,
        "threshold" bigint NOT NULL DEFAULT 0,
        "categoryId" uuid,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_side_discounts_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "freightCost" bigint NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "freightReceiptUrl" varchar;`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "intraCityFee" bigint NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "perKgFee" bigint NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "freeShipping" boolean NOT NULL DEFAULT false;`);

    await queryRunner.query(`ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "intraCityFee" bigint NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "perKgFee" bigint NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "freeShipping" boolean NOT NULL DEFAULT false;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN IF EXISTS "freeShipping";`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN IF EXISTS "perKgFee";`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN IF EXISTS "intraCityFee";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "freeShipping";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "perKgFee";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "intraCityFee";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "freightReceiptUrl";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "freightCost";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "side_discounts";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tiered_discounts";`);
    await queryRunner.query(`ALTER TABLE "discount_codes" DROP COLUMN IF EXISTS "startsAt";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_spec_memory";`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "isDiscounted";`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "sizeType";`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "specs";`);
  }
}

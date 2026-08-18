import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-channel product discounts + pack MOQ default.
 * Additive. Does not rewrite existing minOrderQty values (those stay as pack counts).
 * Unambiguous discount backfill only: channel flag is set iff shared isDiscounted
 * AND that channel's compare-at > final > 0. Ambiguous rows stay false.
 */
export class ProductChannelSalePack1755510000001 implements MigrationInterface {
  name = 'ProductChannelSalePack1755510000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "wholesaleIsDiscounted" boolean NULL,
        ADD COLUMN IF NOT EXISTS "retailIsDiscounted" boolean NULL,
        ADD COLUMN IF NOT EXISTS "wholesaleDiscountType" varchar NULL,
        ADD COLUMN IF NOT EXISTS "retailDiscountType" varchar NULL,
        ADD COLUMN IF NOT EXISTS "wholesaleDiscountPercent" integer NULL,
        ADD COLUMN IF NOT EXISTS "retailDiscountPercent" integer NULL,
        ADD COLUMN IF NOT EXISTS "wholesaleDiscountAmount" bigint NULL,
        ADD COLUMN IF NOT EXISTS "retailDiscountAmount" bigint NULL,
        ADD COLUMN IF NOT EXISTS "wholesaleDiscountStartsAt" TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS "retailDiscountStartsAt" TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS "wholesaleDiscountEndsAt" TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS "retailDiscountEndsAt" TIMESTAMPTZ NULL
    `);

    await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "minOrderQty" SET DEFAULT 1`);
    // Intentionally no UPDATE of existing minOrderQty or discount flags.
    // Channel flags stay NULL so runtime falls back to legacy isDiscounted
    // until an owner-approved backfill runs.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "minOrderQty" SET DEFAULT 6`);
    await queryRunner.query(`
      ALTER TABLE "products"
        DROP COLUMN IF EXISTS "wholesaleIsDiscounted",
        DROP COLUMN IF EXISTS "retailIsDiscounted",
        DROP COLUMN IF EXISTS "wholesaleDiscountType",
        DROP COLUMN IF EXISTS "retailDiscountType",
        DROP COLUMN IF EXISTS "wholesaleDiscountPercent",
        DROP COLUMN IF EXISTS "retailDiscountPercent",
        DROP COLUMN IF EXISTS "wholesaleDiscountAmount",
        DROP COLUMN IF EXISTS "retailDiscountAmount",
        DROP COLUMN IF EXISTS "wholesaleDiscountStartsAt",
        DROP COLUMN IF EXISTS "retailDiscountStartsAt",
        DROP COLUMN IF EXISTS "wholesaleDiscountEndsAt",
        DROP COLUMN IF EXISTS "retailDiscountEndsAt"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hardening: unique payment authority/refId + order idempotencyKey.
 * Partial unique indexes allow multiple NULLs.
 */
export class HardeningPaymentOrderUnique20260731 implements MigrationInterface {
  name = 'HardeningPaymentOrderUnique20260731';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "idempotencyKey" varchar NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_orders_idempotencyKey"
      ON "orders" ("idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payments_authority"
      ON "payments" ("authority")
      WHERE "authority" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payments_refId"
      ON "payments" ("refId")
      WHERE "refId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_payments_refId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_payments_authority"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_orders_idempotencyKey"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "idempotencyKey"`);
  }
}

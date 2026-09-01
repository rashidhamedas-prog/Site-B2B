import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive: commit stock only after settlement; customer address book.
 * Existing open orders already deducted at create — mark them committed
 * so cancel still restores. New orders stay uncommitted until CONFIRMED.
 */
export class StockCommitAndAddresses1756713600001 implements MigrationInterface {
  name = 'StockCommitAndAddresses1756713600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "stockCommittedAt" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      UPDATE "orders"
      SET "stockCommittedAt" = "createdAt"
      WHERE "stockCommittedAt" IS NULL
        AND "effectsReversedAt" IS NULL
        AND status NOT IN ('CANCELLED', 'DELETED')
    `);
    await queryRunner.query(`
      ALTER TABLE "customers"
      ADD COLUMN IF NOT EXISTS "savedAddresses" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customers" DROP COLUMN IF EXISTS "savedAddresses"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders" DROP COLUMN IF EXISTS "stockCommittedAt"
    `);
  }
}

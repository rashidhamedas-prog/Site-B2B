import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 6: credit tracking + one contract per order (additive). */
export class InstallmentCreditFields1755021700001 implements MigrationInterface {
  name = 'InstallmentCreditFields1755021700001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "installment_contracts"
      ADD COLUMN IF NOT EXISTS "creditConsumedIrr" bigint NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "installment_contracts"
      ADD COLUMN IF NOT EXISTS "approvedBy" varchar NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "installment_contracts"
      ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "installment_contracts"
      ADD COLUMN IF NOT EXISTS "ruleId" varchar NULL
    `);

    // One contract per order — unique index if not already present.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_installment_contracts_orderId"
      ON "installment_contracts" ("orderId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_installment_contracts_orderId"`);
    await queryRunner.query(`
      ALTER TABLE "installment_contracts" DROP COLUMN IF EXISTS "ruleId"
    `);
    await queryRunner.query(`
      ALTER TABLE "installment_contracts" DROP COLUMN IF EXISTS "approvedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "installment_contracts" DROP COLUMN IF EXISTS "approvedBy"
    `);
    await queryRunner.query(`
      ALTER TABLE "installment_contracts" DROP COLUMN IF EXISTS "creditConsumedIrr"
    `);
  }
}

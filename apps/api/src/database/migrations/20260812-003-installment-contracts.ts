import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 6: internal B2B installment contracts + schedules (additive). */
export class InstallmentContracts1755021600001 implements MigrationInterface {
  name = 'InstallmentContracts1755021600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "installment_contracts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "customerId" uuid NOT NULL,
        "orderId" uuid NOT NULL,
        "providerCode" varchar NOT NULL DEFAULT 'INTERNAL',
        "principalIrr" bigint NOT NULL,
        "downPaymentIrr" bigint NOT NULL DEFAULT 0,
        "termCount" int NOT NULL,
        "effectiveAmountIrr" bigint NOT NULL,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "externalContractId" varchar NULL,
        "notes" text NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_installment_contracts_customerId"
      ON "installment_contracts" ("customerId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_installment_contracts_orderId"
      ON "installment_contracts" ("orderId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "installment_schedules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "contractId" uuid NOT NULL,
        "installmentNo" int NOT NULL,
        "dueAt" TIMESTAMPTZ NOT NULL,
        "amountIrr" bigint NOT NULL,
        "paidAmountIrr" bigint NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "providerReference" varchar NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_installment_schedules_contract_no"
      ON "installment_schedules" ("contractId", "installmentNo")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "installment_schedules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "installment_contracts"`);
  }
}

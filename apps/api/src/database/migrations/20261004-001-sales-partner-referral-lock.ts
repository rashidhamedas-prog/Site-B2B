import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive only. Code rollback must not run down() on a live ledger:
 * down() drops the new referral columns, not payment or commission history.
 */
export class SalesPartnerReferralLock1759540000001 implements MigrationInterface {
  name = 'SalesPartnerReferralLock1759540000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_referral_sessions" (
        "id" uuid NOT NULL,
        "salesPartnerId" uuid NOT NULL,
        "publicCode" varchar(8) NOT NULL,
        "productIds" jsonb NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "supersededAt" timestamptz,
        "previousSessionId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_partner_referral_sessions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sp_referral_sessions_partner"
      ON "sales_partner_referral_sessions" ("salesPartnerId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sp_referral_sessions_code_created"
      ON "sales_partner_referral_sessions" ("publicCode", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sp_referral_sessions_expires"
      ON "sales_partner_referral_sessions" ("expiresAt")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_referral_bindings" (
        "customerId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "salesPartnerId" uuid NOT NULL,
        "publicCode" varchar(8) NOT NULL,
        "productIds" jsonb NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_partner_referral_bindings" PRIMARY KEY ("customerId")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_ledger_retries" (
        "orderId" uuid NOT NULL,
        "attempts" int NOT NULL DEFAULT 0,
        "lastError" text,
        "nextAttemptAt" timestamptz NOT NULL,
        CONSTRAINT "PK_sales_partner_ledger_retries" PRIMARY KEY ("orderId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "referralSessionId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "referralExclusiveGateway" varchar(16)
    `);
    await queryRunner.query(`
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "salesPartnerCommissionFreeze" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "salesPartnerLedgerAppliedAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "sales_commission_ledger_entries"
      ADD COLUMN IF NOT EXISTS "settledIrr" bigint NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      UPDATE "sales_commission_ledger_entries"
      SET "settledIrr" = "amountIrr"::bigint
      WHERE "payoutId" IS NOT NULL
        AND "entryType" = 'COMMISSION_EARNED'
        AND "settledIrr" = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sales_commission_ledger_entries" DROP COLUMN IF EXISTS "settledIrr"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "salesPartnerLedgerAppliedAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "salesPartnerCommissionFreeze"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "referralExclusiveGateway"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "referralSessionId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_partner_ledger_retries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_partner_referral_bindings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_partner_referral_sessions"`);
  }
}

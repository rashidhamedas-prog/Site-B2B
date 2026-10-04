import { MigrationInterface, QueryRunner } from 'typeorm';

/** Expand-only: reversal bucket + room for hashed idempotency keys. */
export class SalesPartnerIntegrity1759564800001 implements MigrationInterface {
  name = 'SalesPartnerIntegrity1759564800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_commission_ledger_entries"
      ADD COLUMN IF NOT EXISTS "bucket" varchar(16)
    `);
    await queryRunner.query(`
      ALTER TABLE "sales_partner_order_drafts"
      ADD COLUMN IF NOT EXISTS "confirmationResumeTokenHash" varchar(64)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_ledger_cursors" (
        "name" varchar(40) NOT NULL,
        "cursorAt" TIMESTAMPTZ,
        "cursorId" uuid,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "lastError" varchar(240),
        CONSTRAINT "PK_sales_partner_ledger_cursors" PRIMARY KEY ("name")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sales_commission_ledger_entries" DROP COLUMN IF EXISTS "bucket"`);
  }
}

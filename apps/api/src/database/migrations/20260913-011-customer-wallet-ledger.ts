import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Append-only customer wallet ledger. customers.balance stays the cache.
 * Existing non-zero balances become one OPENING credit so history reconciles.
 */
export class CustomerWalletLedger1757768400011 implements MigrationInterface {
  name = 'CustomerWalletLedger1757768400011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_wallet_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "customerId" uuid NOT NULL,
        "direction" varchar(16) NOT NULL,
        "amount" bigint NOT NULL,
        "reasonCode" varchar(32) NOT NULL,
        "referenceType" varchar(32),
        "referenceId" varchar(64),
        "idempotencyKey" varchar(120) NOT NULL,
        "actorUserId" uuid,
        "note" varchar(500),
        "balanceAfter" bigint NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_wallet_entries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_customer_wallet_idempotencyKey" UNIQUE ("idempotencyKey")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_wallet_customerId"
      ON "customer_wallet_entries" ("customerId")
    `);
    await queryRunner.query(`
      INSERT INTO "customer_wallet_entries"
        ("customerId", "direction", "amount", "reasonCode", "referenceType", "referenceId",
         "idempotencyKey", "note", "balanceAfter")
      SELECT
        c.id,
        CASE WHEN c.balance >= 0 THEN 'CREDIT' ELSE 'DEBIT' END,
        ABS(c.balance),
        'OPENING',
        'customer',
        c.id::text,
        'opening:' || c.id::text,
        'مانده اولیه قبل از دفتر کیف پول',
        c.balance
      FROM customers c
      WHERE c.balance <> 0
        AND NOT EXISTS (
          SELECT 1 FROM "customer_wallet_entries" e
          WHERE e."idempotencyKey" = 'opening:' || c.id::text
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_wallet_entries"`);
  }
}

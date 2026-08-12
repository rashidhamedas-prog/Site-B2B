import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 payment core hardening — additive only.
 * - orders: idempotencyPayloadHash, idempotencyScope
 * - payments: postbackFiredAt, attemptCount
 * - payment_attempts, refunds, payment_ledger_entries
 *
 * Ownership-aware down(): drops Phase-1-owned tables only when empty / owned;
 * never destroys payment history with rows present.
 */
export class PaymentCoreHardening1755000000001 implements MigrationInterface {
  name = 'PaymentCoreHardening1755000000001';

  private static readonly OWNED = [
    'payment_attempts',
    'refunds',
    'payment_ledger_entries',
  ] as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureOwnershipTable(queryRunner);

    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "idempotencyPayloadHash" varchar NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "idempotencyScope" varchar NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_idempotencyScope"
      ON "orders" ("idempotencyScope")
      WHERE "idempotencyScope" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "postbackFiredAt" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "attemptCount" int NOT NULL DEFAULT 0
    `);

    const attemptsExisted = await this.tableExists(queryRunner, 'payment_attempts');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "paymentId" uuid NOT NULL,
        "providerCode" varchar NOT NULL DEFAULT 'ZARINPAL',
        "attemptNo" int NOT NULL DEFAULT 1,
        "idempotencyKey" varchar NULL,
        "providerToken" varchar NULL,
        "providerTransactionId" varchar NULL,
        "amount" bigint NOT NULL,
        "currency" varchar NOT NULL DEFAULT 'IRR',
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "expiresAt" TIMESTAMPTZ NULL,
        "requestFingerprint" varchar NULL,
        "sanitizedRequest" jsonb NULL,
        "sanitizedResponse" jsonb NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_attempts_payment_attemptNo"
      ON "payment_attempts" ("paymentId", "attemptNo")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_attempts_paymentId"
      ON "payment_attempts" ("paymentId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_attempts_idempotencyKey"
      ON "payment_attempts" ("idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_attempts_status"
      ON "payment_attempts" ("status")
    `);
    if (!attemptsExisted) {
      await this.recordOwnership(queryRunner, 'payment_attempts');
    }

    const refundsExisted = await this.tableExists(queryRunner, 'refunds');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refunds" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "paymentId" uuid NOT NULL,
        "amount" bigint NOT NULL,
        "reason" text NULL,
        "status" varchar NOT NULL DEFAULT 'REQUESTED',
        "refundChannel" varchar NOT NULL DEFAULT 'WALLET',
        "providerRefundId" varchar NULL,
        "idempotencyKey" varchar NOT NULL,
        "requestedBy" uuid NULL,
        "failureCode" varchar NULL,
        "completedAt" TIMESTAMPTZ NULL,
        "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_refunds_payment_idempotency"
      ON "refunds" ("paymentId", "idempotencyKey")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refunds_paymentId"
      ON "refunds" ("paymentId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refunds_status"
      ON "refunds" ("status")
    `);
    if (!refundsExisted) {
      await this.recordOwnership(queryRunner, 'refunds');
    }

    const ledgerExisted = await this.tableExists(
      queryRunner,
      'payment_ledger_entries',
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_ledger_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "paymentId" uuid NULL,
        "orderId" uuid NULL,
        "invoiceId" uuid NULL,
        "entryType" varchar NOT NULL,
        "amount" bigint NOT NULL,
        "currency" varchar NOT NULL DEFAULT 'IRR',
        "idempotencyKey" varchar NULL,
        "actorUserId" uuid NULL,
        "correlationId" varchar NULL,
        "meta" jsonb NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_ledger_idempotency"
      ON "payment_ledger_entries" ("idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_ledger_paymentId"
      ON "payment_ledger_entries" ("paymentId")
      WHERE "paymentId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_ledger_orderId"
      ON "payment_ledger_entries" ("orderId")
      WHERE "orderId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_ledger_invoiceId"
      ON "payment_ledger_entries" ("invoiceId")
      WHERE "invoiceId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_ledger_entryType"
      ON "payment_ledger_entries" ("entryType")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_ledger_createdAt"
      ON "payment_ledger_entries" ("createdAt")
    `);
    if (!ledgerExisted) {
      await this.recordOwnership(queryRunner, 'payment_ledger_entries');
    }

    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments')
           AND NOT EXISTS (
             SELECT 1 FROM information_schema.table_constraints
             WHERE constraint_name = 'FK_payment_attempts_paymentId'
           ) THEN
          ALTER TABLE "payment_attempts"
            ADD CONSTRAINT "FK_payment_attempts_paymentId"
            FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments')
           AND NOT EXISTS (
             SELECT 1 FROM information_schema.table_constraints
             WHERE constraint_name = 'FK_refunds_paymentId'
           ) THEN
          ALTER TABLE "refunds"
            ADD CONSTRAINT "FK_refunds_paymentId"
            FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop owned tables only when empty and owned by this migration.
    for (const objectName of [...PaymentCoreHardening1755000000001.OWNED].reverse()) {
      const owned = await this.isOwned(queryRunner, objectName);
      if (!owned) continue;
      const countRows = await queryRunner.query(
        `SELECT COUNT(*)::int AS c FROM "${objectName}"`,
      );
      const count = Number(countRows?.[0]?.c ?? 0);
      if (count > 0) {
        throw new Error(
          `PaymentCoreHardening1755000000001 refuse DROP "${objectName}" with ${count} row(s)`,
        );
      }
      if (objectName === 'payment_attempts') {
        await queryRunner.query(
          `ALTER TABLE "payment_attempts" DROP CONSTRAINT IF EXISTS "FK_payment_attempts_paymentId"`,
        );
        await queryRunner.query(
          `DROP INDEX IF EXISTS "UQ_payment_attempts_payment_attemptNo"`,
        );
        await queryRunner.query(
          `DROP INDEX IF EXISTS "IDX_payment_attempts_paymentId"`,
        );
        await queryRunner.query(
          `DROP INDEX IF EXISTS "IDX_payment_attempts_idempotencyKey"`,
        );
        await queryRunner.query(
          `DROP INDEX IF EXISTS "IDX_payment_attempts_status"`,
        );
      }
      if (objectName === 'refunds') {
        await queryRunner.query(
          `ALTER TABLE "refunds" DROP CONSTRAINT IF EXISTS "FK_refunds_paymentId"`,
        );
        await queryRunner.query(
          `DROP INDEX IF EXISTS "UQ_refunds_payment_idempotency"`,
        );
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refunds_paymentId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refunds_status"`);
      }
      if (objectName === 'payment_ledger_entries') {
        await queryRunner.query(
          `DROP INDEX IF EXISTS "UQ_payment_ledger_idempotency"`,
        );
        await queryRunner.query(
          `DROP INDEX IF EXISTS "IDX_payment_ledger_paymentId"`,
        );
        await queryRunner.query(
          `DROP INDEX IF EXISTS "IDX_payment_ledger_orderId"`,
        );
        await queryRunner.query(
          `DROP INDEX IF EXISTS "IDX_payment_ledger_invoiceId"`,
        );
        await queryRunner.query(
          `DROP INDEX IF EXISTS "IDX_payment_ledger_entryType"`,
        );
        await queryRunner.query(
          `DROP INDEX IF EXISTS "IDX_payment_ledger_createdAt"`,
        );
        await queryRunner.query(
          `DROP INDEX IF EXISTS "IDX_payment_ledger_idempotencyKey"`,
        );
      }
      await queryRunner.query(`DROP TABLE IF EXISTS "${objectName}"`);
      await queryRunner.query(
        `DELETE FROM "schema_migration_ownership" WHERE "migration_name" = $1 AND "object_name" = $2`,
        [this.name, objectName],
      );
    }

    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN IF EXISTS "attemptCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN IF EXISTS "postbackFiredAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_orders_idempotencyScope"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "idempotencyScope"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "idempotencyPayloadHash"`,
    );
  }

  private async tableExists(
    queryRunner: QueryRunner,
    table: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  private async ensureOwnershipTable(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "schema_migration_ownership" (
        "migration_name" varchar NOT NULL,
        "object_name" varchar NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY ("migration_name", "object_name")
      )
    `);
  }

  private async recordOwnership(
    queryRunner: QueryRunner,
    objectName: string,
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO "schema_migration_ownership" ("migration_name", "object_name", "created_at")
        VALUES ($1, $2, now())
        ON CONFLICT ("migration_name", "object_name") DO NOTHING
      `,
      [this.name, objectName],
    );
  }

  private async isOwned(
    queryRunner: QueryRunner,
    objectName: string,
  ): Promise<boolean> {
    const hasTable = await this.tableExists(
      queryRunner,
      'schema_migration_ownership',
    );
    if (!hasTable) return false;
    const rows = await queryRunner.query(
      `SELECT 1 FROM "schema_migration_ownership" WHERE "migration_name" = $1 AND "object_name" = $2`,
      [this.name, objectName],
    );
    return Array.isArray(rows) && rows.length > 0;
  }
}

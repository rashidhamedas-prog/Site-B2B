import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create return_requests schema for RMA (idempotent, ownership-aware).
 * Does not enable synchronize/DB_SYNC. Expand-only DDL with deliberate FKs/indexes.
 *
 * Ownership: if this migration creates the table, it records a row in
 * schema_migration_ownership so down() may DROP TABLE. If the table already
 * existed (adoption), expand-only runs and down() must not destroy RMA data.
 */
export class CreateReturnRequests1754812800001 implements MigrationInterface {
  name = 'CreateReturnRequests1754812800001';

  private static readonly OBJECT_NAME = 'return_requests';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExisted = await this.tableExists(
      queryRunner,
      CreateReturnRequests1754812800001.OBJECT_NAME
    );

    if (!tableExisted) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "return_requests" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "orderId" uuid NOT NULL,
          "orderItemId" uuid NOT NULL,
          "customerId" uuid NOT NULL,
          "reason" text NOT NULL,
          "requestedSize" varchar,
          "requestType" varchar NOT NULL DEFAULT 'RETURN',
          "status" varchar NOT NULL DEFAULT 'PENDING',
          "refundType" varchar NOT NULL DEFAULT 'WALLET',
          "adminNote" text,
          "processedAt" TIMESTAMPTZ,
          "processedByUserId" uuid,
          "processingMarker" varchar,
          "walletCreditAmount" bigint,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await this.ensureOwnershipTable(queryRunner);
      await queryRunner.query(
        `
          INSERT INTO "schema_migration_ownership" ("migration_name", "object_name", "created_at")
          VALUES ($1, $2, now())
          ON CONFLICT ("migration_name", "object_name") DO NOTHING
        `,
        [this.name, CreateReturnRequests1754812800001.OBJECT_NAME]
      );
    }

    // Expand if table already existed without new columns (prod may have been sync-created earlier).
    await queryRunner.query(
      `ALTER TABLE "return_requests" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMPTZ`
    );
    await queryRunner.query(
      `ALTER TABLE "return_requests" ADD COLUMN IF NOT EXISTS "processedByUserId" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "return_requests" ADD COLUMN IF NOT EXISTS "processingMarker" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "return_requests" ADD COLUMN IF NOT EXISTS "walletCreditAmount" bigint`
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_return_requests_processingMarker"
      ON "return_requests" ("processingMarker")
      WHERE "processingMarker" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_return_requests_status_createdAt"
      ON "return_requests" ("status", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_return_requests_customerId"
      ON "return_requests" ("customerId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_return_requests_active_orderItem"
      ON "return_requests" ("orderItemId")
      WHERE "status" IN ('PENDING', 'APPROVED', 'COMPLETED')
    `);

    // FKs: only add when referenced tables exist; ON DELETE RESTRICT for financial integrity.
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders')
           AND NOT EXISTS (
             SELECT 1 FROM information_schema.table_constraints
             WHERE constraint_name = 'FK_return_requests_orderId'
           ) THEN
          ALTER TABLE "return_requests"
            ADD CONSTRAINT "FK_return_requests_orderId"
            FOREIGN KEY ("orderId") REFERENCES "orders"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items')
           AND NOT EXISTS (
             SELECT 1 FROM information_schema.table_constraints
             WHERE constraint_name = 'FK_return_requests_orderItemId'
           ) THEN
          ALTER TABLE "return_requests"
            ADD CONSTRAINT "FK_return_requests_orderItemId"
            FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers')
           AND NOT EXISTS (
             SELECT 1 FROM information_schema.table_constraints
             WHERE constraint_name = 'FK_return_requests_customerId'
           ) THEN
          ALTER TABLE "return_requests"
            ADD CONSTRAINT "FK_return_requests_customerId"
            FOREIGN KEY ("customerId") REFERENCES "customers"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "return_requests" DROP CONSTRAINT IF EXISTS "FK_return_requests_customerId"`
    );
    await queryRunner.query(
      `ALTER TABLE "return_requests" DROP CONSTRAINT IF EXISTS "FK_return_requests_orderItemId"`
    );
    await queryRunner.query(
      `ALTER TABLE "return_requests" DROP CONSTRAINT IF EXISTS "FK_return_requests_orderId"`
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_return_requests_active_orderItem"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_return_requests_customerId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_return_requests_status_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_return_requests_processingMarker"`);

    const owned = await this.hasOwnership(
      queryRunner,
      this.name,
      CreateReturnRequests1754812800001.OBJECT_NAME
    );

    if (owned) {
      // Only drop when this migration created the table (ownership claimed in up).
      await queryRunner.query(`DROP TABLE IF EXISTS "return_requests"`);
    }
    // Adopted path: leave table/data and expand columns (forward-compatible).
    // Always clear ownership row when the ledger table exists.
    await this.clearOwnership(
      queryRunner,
      this.name,
      CreateReturnRequests1754812800001.OBJECT_NAME
    );
  }

  private async tableExists(queryRunner: QueryRunner, tableName: string): Promise<boolean> {
    const rows: Array<{ exists: number | boolean }> = await queryRunner.query(
      `
        SELECT 1 AS exists
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
        LIMIT 1
      `,
      [tableName]
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

  private async hasOwnership(
    queryRunner: QueryRunner,
    migrationName: string,
    objectName: string
  ): Promise<boolean> {
    const ownershipExists = await this.tableExists(queryRunner, 'schema_migration_ownership');
    if (!ownershipExists) {
      return false;
    }
    const rows: unknown[] = await queryRunner.query(
      `
        SELECT 1
        FROM "schema_migration_ownership"
        WHERE "migration_name" = $1 AND "object_name" = $2
        LIMIT 1
      `,
      [migrationName, objectName]
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  private async clearOwnership(
    queryRunner: QueryRunner,
    migrationName: string,
    objectName: string
  ): Promise<void> {
    const ownershipExists = await this.tableExists(queryRunner, 'schema_migration_ownership');
    if (!ownershipExists) {
      return;
    }
    await queryRunner.query(
      `
        DELETE FROM "schema_migration_ownership"
        WHERE "migration_name" = $1 AND "object_name" = $2
      `,
      [migrationName, objectName]
    );
  }
}

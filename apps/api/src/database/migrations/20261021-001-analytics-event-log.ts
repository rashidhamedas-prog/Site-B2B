import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Server-side GA4 exactly-once ledger.
 * Additive only. Rollback drops the table (no business data lost).
 */
export class AnalyticsEventLog1761004800001 implements MigrationInterface {
  name = 'AnalyticsEventLog1761004800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "analytics_event_log" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "eventName" varchar(40) NOT NULL,
        "transactionId" varchar(64) NOT NULL,
        "channel" varchar(20) NOT NULL,
        "measurementId" varchar(20) NULL,
        "orderId" uuid NULL,
        "paymentId" uuid NULL,
        "status" varchar(16) NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "valueIrr" bigint NOT NULL DEFAULT 0,
        "lastError" text NULL,
        "sentAt" timestamptz NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analytics_event_log_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_analytics_event_log_event_txn" UNIQUE ("eventName", "transactionId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_analytics_event_log_status" ON "analytics_event_log" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_analytics_event_log_order" ON "analytics_event_log" ("orderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "analytics_event_log"`);
  }
}

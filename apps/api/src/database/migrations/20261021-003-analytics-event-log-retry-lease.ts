import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * GA4 ledger retry model: original purchase time, backoff due time, claim lease.
 * Additive nullable columns; backfills eventAt from createdAt so old rows age out.
 * Rollback drops the index and the three columns.
 */
export class AnalyticsEventLogRetryLease1761004800003 implements MigrationInterface {
  name = 'AnalyticsEventLogRetryLease1761004800003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "analytics_event_log" ADD COLUMN IF NOT EXISTS "eventAt" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "analytics_event_log" ADD COLUMN IF NOT EXISTS "nextAttemptAt" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "analytics_event_log" ADD COLUMN IF NOT EXISTS "leaseUntil" timestamptz NULL`,
    );
    await queryRunner.query(
      `UPDATE "analytics_event_log" SET "eventAt" = "createdAt"::timestamptz WHERE "eventAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_analytics_event_log_status_next" ON "analytics_event_log" ("status", "nextAttemptAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_analytics_event_log_status_next"`);
    await queryRunner.query(`ALTER TABLE "analytics_event_log" DROP COLUMN IF EXISTS "leaseUntil"`);
    await queryRunner.query(`ALTER TABLE "analytics_event_log" DROP COLUMN IF EXISTS "nextAttemptAt"`);
    await queryRunner.query(`ALTER TABLE "analytics_event_log" DROP COLUMN IF EXISTS "eventAt"`);
  }
}

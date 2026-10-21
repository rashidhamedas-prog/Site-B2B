import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Store the pseudonymous GA client/session id on the GA4 ledger so a failed
 * server-owned purchase can be retried by the background job (no PII).
 * Additive only; rollback drops the two nullable columns.
 */
export class AnalyticsEventLogGaIds1761004800002 implements MigrationInterface {
  name = 'AnalyticsEventLogGaIds1761004800002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "analytics_event_log" ADD COLUMN IF NOT EXISTS "gaClientId" varchar(32) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "analytics_event_log" ADD COLUMN IF NOT EXISTS "gaSessionId" varchar(20) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "analytics_event_log" DROP COLUMN IF EXISTS "gaSessionId"`);
    await queryRunner.query(`ALTER TABLE "analytics_event_log" DROP COLUMN IF EXISTS "gaClientId"`);
  }
}

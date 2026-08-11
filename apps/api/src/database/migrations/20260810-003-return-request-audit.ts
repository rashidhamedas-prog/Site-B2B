import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Append-only audit trail for RMA financial transitions.
 * Expand-only; safe to leave in place on rollback of app code.
 */
export class ReturnRequestAudit1754820000001 implements MigrationInterface {
  name = 'ReturnRequestAudit1754820000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "return_request_audits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "returnRequestId" uuid NOT NULL,
        "actorUserId" uuid,
        "fromStatus" varchar NOT NULL,
        "toStatus" varchar NOT NULL,
        "processingMarker" varchar,
        "requestType" varchar,
        "refundType" varchar,
        "walletCreditAmount" bigint,
        "variantId" uuid,
        "stockBefore" int,
        "stockAfter" int,
        "correlationId" varchar,
        "meta" jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_return_request_audits_requestId"
      ON "return_request_audits" ("returnRequestId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_return_request_audits_marker"
      ON "return_request_audits" ("processingMarker")
      WHERE "processingMarker" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Audit is append-only financial evidence — refuse destructive drop if rows exist.
    const rows = await queryRunner.query(`SELECT COUNT(*)::int AS c FROM "return_request_audits"`);
    const count = Number(rows?.[0]?.c ?? 0);
    if (count > 0) {
      throw new Error(
        `ReturnRequestAudit1754820000001 is fail-closed: refuse DROP with ${count} audit row(s). Archive first.`
      );
    }
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_return_request_audits_marker"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_return_request_audits_requestId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "return_request_audits"`);
  }
}

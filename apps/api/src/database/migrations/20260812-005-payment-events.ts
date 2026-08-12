import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 2 residual: idempotent payment_events table (additive). */
export class PaymentEvents1755021600002 implements MigrationInterface {
  name = 'PaymentEvents1755021600002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "providerCode" varchar NOT NULL,
        "externalEventId" varchar NOT NULL,
        "eventType" varchar NOT NULL,
        "payloadHash" varchar,
        "signatureValid" boolean NOT NULL DEFAULT false,
        "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "processedAt" TIMESTAMPTZ,
        "processingStatus" varchar NOT NULL DEFAULT 'RECEIVED',
        "paymentId" uuid,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_events_provider_external"
      ON "payment_events" ("providerCode", "externalEventId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_events_processingStatus"
      ON "payment_events" ("processingStatus")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_events_paymentId"
      ON "payment_events" ("paymentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_events"`);
  }
}

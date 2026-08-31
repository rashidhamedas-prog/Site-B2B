import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive audit table for manual publish / retry / reconcile. */
export class OmnichannelAudit1756470000001 implements MigrationInterface {
  name = 'OmnichannelAudit1756470000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_audits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actorId" varchar NOT NULL,
        "action" varchar NOT NULL,
        "entityType" varchar NOT NULL,
        "entityId" varchar NOT NULL,
        "channel" varchar,
        "reason" text,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_omnichannel_audits_entity"
      ON "omnichannel_audits" ("entityType", "entityId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_audits"`);
  }
}

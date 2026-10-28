import { MigrationInterface, QueryRunner } from 'typeorm';

export class SmsDlr1761523600005 implements MigrationInterface {
  name = 'SmsDlr1761523600005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sms_message"
        ADD COLUMN IF NOT EXISTS "dlrCheckedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "dlrAttempts" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "source" character varying(32),
        ADD COLUMN IF NOT EXISTS "segmentId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sms_message_status_dlr"
        ON "sms_message" ("status", "dlrCheckedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sms_message_status_dlr"`);
    await queryRunner.query(`
      ALTER TABLE "sms_message"
        DROP COLUMN IF EXISTS "segmentId",
        DROP COLUMN IF EXISTS "source",
        DROP COLUMN IF EXISTS "dlrAttempts",
        DROP COLUMN IF EXISTS "dlrCheckedAt"
    `);
  }
}

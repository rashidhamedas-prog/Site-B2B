import { MigrationInterface, QueryRunner } from 'typeorm';

export class SmsPanelHardening1761480000003 implements MigrationInterface {
  name = 'SmsPanelHardening1761480000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_campaign_recipient" (
        "campaignId" uuid NOT NULL,
        "phoneNormalized" varchar(16) NOT NULL,
        "customerId" varchar,
        "parts" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_sms_campaign_recipient" PRIMARY KEY ("campaignId", "phoneNormalized")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sms_campaign_recipient_campaign" ON "sms_campaign_recipient" ("campaignId")`,
    );

    await queryRunner.query(`
      ALTER TABLE "sms_confirmation"
        ADD COLUMN IF NOT EXISTS "otpHash" varchar(128),
        ADD COLUMN IF NOT EXISTS "otpExpiresAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "otpAttempts" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sms_confirmation" DROP COLUMN IF EXISTS "otpAttempts"`);
    await queryRunner.query(`ALTER TABLE "sms_confirmation" DROP COLUMN IF EXISTS "otpExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "sms_confirmation" DROP COLUMN IF EXISTS "otpHash"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_campaign_recipient"`);
  }
}

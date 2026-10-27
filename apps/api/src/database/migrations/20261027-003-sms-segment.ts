import { MigrationInterface, QueryRunner } from 'typeorm';

export class SmsSegment1761523400003 implements MigrationInterface {
  name = 'SmsSegment1761523400003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_segment" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "sources" text[] NOT NULL DEFAULT '{}',
        "rules" jsonb NOT NULL DEFAULT '[]',
        "createdBy" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "sms_campaign"
        ADD COLUMN IF NOT EXISTS "segmentId" uuid,
        ADD COLUMN IF NOT EXISTS "audienceSpec" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sms_campaign" DROP COLUMN IF EXISTS "audienceSpec"`);
    await queryRunner.query(`ALTER TABLE "sms_campaign" DROP COLUMN IF EXISTS "segmentId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_segment"`);
  }
}

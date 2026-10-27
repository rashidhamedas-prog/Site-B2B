import { MigrationInterface, QueryRunner } from 'typeorm';

export class SmsTemplateVars1761523500004 implements MigrationInterface {
  name = 'SmsTemplateVars1761523500004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sms_campaign"
        ADD COLUMN IF NOT EXISTS "varFallbacks" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sms_campaign" DROP COLUMN IF EXISTS "varFallbacks"`);
  }
}

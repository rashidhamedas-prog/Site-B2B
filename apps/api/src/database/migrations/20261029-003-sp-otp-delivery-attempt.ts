import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpOtpDeliveryAttempt1761782400003 implements MigrationInterface {
  name = 'SpOtpDeliveryAttempt1761782400003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_partner_applications"
      ADD COLUMN IF NOT EXISTS "lastSmsAttempt" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "sales_partner_profiles"
      ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_partner_profiles" DROP COLUMN IF EXISTS "mustChangePassword"
    `);
    await queryRunner.query(`
      ALTER TABLE "sales_partner_applications" DROP COLUMN IF EXISTS "lastSmsAttempt"
    `);
  }
}

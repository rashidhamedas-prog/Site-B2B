import { MigrationInterface, QueryRunner } from 'typeorm';

export class SalesPartnerApplyAnswers1759380000001 implements MigrationInterface {
  name = 'SalesPartnerApplyAnswers1759380000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_partner_applications"
      ADD COLUMN IF NOT EXISTS "answers" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "sales_partner_profiles"
      ADD COLUMN IF NOT EXISTS "applicationAnswers" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sales_partner_profiles" DROP COLUMN IF EXISTS "applicationAnswers"`);
    await queryRunner.query(`ALTER TABLE "sales_partner_applications" DROP COLUMN IF EXISTS "answers"`);
  }
}

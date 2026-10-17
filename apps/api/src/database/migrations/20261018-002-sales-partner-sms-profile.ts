import { MigrationInterface, QueryRunner } from 'typeorm';

/** Editable slots for the customer confirmation SMS. Legal lines stay in code. */
export class SalesPartnerSmsProfile1760822400002 implements MigrationInterface {
  name = 'SalesPartnerSmsProfile1760822400002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sales_partner_profiles" ADD COLUMN IF NOT EXISTS "smsShopName" varchar(32)`);
    await queryRunner.query(`ALTER TABLE "sales_partner_profiles" ADD COLUMN IF NOT EXISTS "smsGreeting" varchar(40)`);
    await queryRunner.query(`ALTER TABLE "sales_partner_profiles" ADD COLUMN IF NOT EXISTS "smsChannel" varchar(16)`);
    await queryRunner.query(`ALTER TABLE "sales_partner_profiles" ADD COLUMN IF NOT EXISTS "smsHandle" varchar(24)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sales_partner_profiles" DROP COLUMN IF EXISTS "smsHandle"`);
    await queryRunner.query(`ALTER TABLE "sales_partner_profiles" DROP COLUMN IF EXISTS "smsChannel"`);
    await queryRunner.query(`ALTER TABLE "sales_partner_profiles" DROP COLUMN IF EXISTS "smsGreeting"`);
    await queryRunner.query(`ALTER TABLE "sales_partner_profiles" DROP COLUMN IF EXISTS "smsShopName"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SalesPartnerPublicCode1758616800004 implements MigrationInterface {
  name = 'SalesPartnerPublicCode1758616800004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_partner_profiles"
      ADD COLUMN IF NOT EXISTS "publicCode" varchar(16)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sales_partner_profiles_publicCode"
      ON "sales_partner_profiles" ("publicCode")
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "salesPartnerProductIds" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "salesPartnerProductIds"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_sales_partner_profiles_publicCode"`);
    await queryRunner.query(`ALTER TABLE "sales_partner_profiles" DROP COLUMN IF EXISTS "publicCode"`);
  }
}

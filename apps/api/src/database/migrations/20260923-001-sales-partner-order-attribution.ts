import { MigrationInterface, QueryRunner } from 'typeorm';

export class SalesPartnerOrderAttribution1758616800003 implements MigrationInterface {
  name = 'SalesPartnerOrderAttribution1758616800003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "salesSource" varchar(24) NOT NULL DEFAULT 'DIRECT'
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "salesPartnerId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "salesPartnerSubmissionId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_salesPartnerId"
      ON "orders" ("salesPartnerId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_salesPartnerId"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "salesPartnerSubmissionId"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "salesPartnerId"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "salesSource"`);
  }
}

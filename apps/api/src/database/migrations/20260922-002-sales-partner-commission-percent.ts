import { MigrationInterface, QueryRunner } from 'typeorm';

export class SalesPartnerCommissionPercent1758546000002 implements MigrationInterface {
  name = 'SalesPartnerCommissionPercent1758546000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_partner_order_draft_items"
      ADD COLUMN IF NOT EXISTS "commissionPercent" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "sales_partner_order_draft_items"
      ADD COLUMN IF NOT EXISTS "ruleId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "sales_partner_order_draft_items"
      ADD COLUMN IF NOT EXISTS "ruleVersion" integer NOT NULL DEFAULT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sales_partner_order_draft_items" DROP COLUMN IF EXISTS "ruleVersion"`);
    await queryRunner.query(`ALTER TABLE "sales_partner_order_draft_items" DROP COLUMN IF EXISTS "ruleId"`);
    await queryRunner.query(`ALTER TABLE "sales_partner_order_draft_items" DROP COLUMN IF EXISTS "commissionPercent"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SalesPartnerPendingRevision1760745600001 implements MigrationInterface {
  name = 'SalesPartnerPendingRevision1760745600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_partner_applications"
      ADD COLUMN IF NOT EXISTS "pendingRevision" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_partner_applications" DROP COLUMN IF EXISTS "pendingRevision"
    `);
  }
}

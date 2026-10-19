import { MigrationInterface, QueryRunner } from 'typeorm';

/** Sweep of open partner drafts filters by status + expiresAt. */
export class SalesPartnerDraftExpiryIndex1761000000001 implements MigrationInterface {
  name = 'SalesPartnerDraftExpiryIndex1761000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sp_drafts_status_expires" ON "sales_partner_order_drafts" ("status", "expiresAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sp_drafts_status_expires"`);
  }
}

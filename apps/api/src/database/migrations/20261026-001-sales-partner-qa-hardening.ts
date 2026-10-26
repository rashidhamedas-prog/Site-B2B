import { MigrationInterface, QueryRunner } from 'typeorm';

/** IBAN change cooldown + signed share-link click audit (sales-partner QA 2026-10). */
export class SalesPartnerQaHardening1761440000001 implements MigrationInterface {
  name = 'SalesPartnerQaHardening1761440000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_partner_profiles"
      ADD COLUMN IF NOT EXISTS "ibanChangedAt" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_link_clicks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(16) NOT NULL,
        "productId" uuid NOT NULL,
        "ipHash" varchar(64) NOT NULL,
        "uaHash" varchar(64) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sp_link_clicks_code_created"
      ON "sales_partner_link_clicks" ("code", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sp_link_clicks_code_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_partner_link_clicks"`);
    await queryRunner.query(`
      ALTER TABLE "sales_partner_profiles"
      DROP COLUMN IF EXISTS "ibanChangedAt"
    `);
  }
}

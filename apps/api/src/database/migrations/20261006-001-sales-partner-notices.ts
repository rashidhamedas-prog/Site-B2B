import { MigrationInterface, QueryRunner } from 'typeorm';

/** One notice for every active sales partner, with a per-partner seen/dismiss receipt. */
export class SalesPartnerNotices1760006400001 implements MigrationInterface {
  name = 'SalesPartnerNotices1760006400001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_notices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(120) NOT NULL,
        "body" varchar(2000) NOT NULL,
        "linkLabel" varchar(40),
        "linkUrl" varchar(500),
        "tone" varchar(16) NOT NULL DEFAULT 'info',
        "audience" varchar(24) NOT NULL DEFAULT 'ACTIVE',
        "audienceCount" integer NOT NULL DEFAULT 0,
        "publishedAt" TIMESTAMPTZ NOT NULL,
        "expiresAt" TIMESTAMPTZ,
        "archivedAt" TIMESTAMPTZ,
        "createdByUserId" uuid,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_partner_notices" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sales_partner_notices_publishedAt"
      ON "sales_partner_notices" ("publishedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sales_partner_notices_archivedAt"
      ON "sales_partner_notices" ("archivedAt")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_notice_receipts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "noticeId" uuid NOT NULL,
        "salesPartnerId" uuid NOT NULL,
        "seenAt" TIMESTAMPTZ NOT NULL,
        "dismissedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_partner_notice_receipts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sales_partner_notice_receipt" UNIQUE ("noticeId", "salesPartnerId"),
        CONSTRAINT "FK_sales_partner_notice_receipt_notice"
          FOREIGN KEY ("noticeId") REFERENCES "sales_partner_notices"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sales_partner_notice_receipt_partner"
          FOREIGN KEY ("salesPartnerId") REFERENCES "sales_partner_profiles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sales_partner_notice_receipts_partner"
      ON "sales_partner_notice_receipts" ("salesPartnerId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_partner_notice_receipts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_partner_notices"`);
  }
}

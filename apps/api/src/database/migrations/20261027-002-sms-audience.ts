import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Default promo consent for sales partners and wholesale-referral partners,
 * plus lookup indexes for audience order stats and customers.phone2.
 * Existing rows are backfilled as OWNER_DEFAULT_POLICY_BACKFILL.
 * New rows keep the column default OWNER_DEFAULT_POLICY.
 */
export class SmsAudience1761523300002 implements MigrationInterface {
  name = 'SmsAudience1761523300002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_partner_profiles"
        ADD COLUMN IF NOT EXISTS "smsPromoConsent" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "smsPromoConsentSource" varchar(32) NOT NULL DEFAULT 'OWNER_DEFAULT_POLICY',
        ADD COLUMN IF NOT EXISTS "smsPromoConsentAt" timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "wholesale_referral_partners"
        ADD COLUMN IF NOT EXISTS "smsPromoConsent" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "smsPromoConsentSource" varchar(32) NOT NULL DEFAULT 'OWNER_DEFAULT_POLICY',
        ADD COLUMN IF NOT EXISTS "smsPromoConsentAt" timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      UPDATE "sales_partner_profiles"
      SET "smsPromoConsentSource" = 'OWNER_DEFAULT_POLICY_BACKFILL',
          "smsPromoConsentAt" = now()
    `);
    await queryRunner.query(`
      UPDATE "wholesale_referral_partners"
      SET "smsPromoConsentSource" = 'OWNER_DEFAULT_POLICY_BACKFILL',
          "smsPromoConsentAt" = now()
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_customerId_createdAt" ON "orders" ("customerId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_customers_phone2" ON "customers" ("phone2")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customers_phone2"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_customerId_createdAt"`);
    await queryRunner.query(`ALTER TABLE "wholesale_referral_partners" DROP COLUMN IF EXISTS "smsPromoConsentAt"`);
    await queryRunner.query(`ALTER TABLE "wholesale_referral_partners" DROP COLUMN IF EXISTS "smsPromoConsentSource"`);
    await queryRunner.query(`ALTER TABLE "wholesale_referral_partners" DROP COLUMN IF EXISTS "smsPromoConsent"`);
    await queryRunner.query(`ALTER TABLE "sales_partner_profiles" DROP COLUMN IF EXISTS "smsPromoConsentAt"`);
    await queryRunner.query(`ALTER TABLE "sales_partner_profiles" DROP COLUMN IF EXISTS "smsPromoConsentSource"`);
    await queryRunner.query(`ALTER TABLE "sales_partner_profiles" DROP COLUMN IF EXISTS "smsPromoConsent"`);
  }
}

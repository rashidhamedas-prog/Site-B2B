import { MigrationInterface, QueryRunner } from 'typeorm';

export class SalesPartnerProgram1758542400001 implements MigrationInterface {
  name = 'SalesPartnerProgram1758542400001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "phone" varchar(15) NOT NULL,
        "displayName" varchar(80) NOT NULL,
        "status" varchar(24) NOT NULL DEFAULT 'PENDING_REVIEW',
        "statusReason" varchar(500),
        "commissionRateOverride" integer,
        "ibanLast4" varchar(4),
        "ibanFingerprint" varchar(64),
        "ibanCipher" text,
        "termsVersion" varchar(40),
        "termsAcceptedAt" TIMESTAMPTZ,
        "riskFlags" jsonb,
        "closedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_partner_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sales_partner_profiles_userId" UNIQUE ("userId"),
        CONSTRAINT "UQ_sales_partner_profiles_phone" UNIQUE ("phone"),
        CONSTRAINT "FK_sales_partner_profiles_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_partner_profiles_status" ON "sales_partner_profiles" ("status")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_applications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "phone" varchar(15) NOT NULL,
        "displayName" varchar(80) NOT NULL,
        "socialHandles" jsonb,
        "status" varchar(24) NOT NULL DEFAULT 'PENDING_OTP',
        "reviewNote" varchar(500),
        "userId" uuid,
        "profileId" uuid,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_partner_applications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_partner_applications_phone" ON "sales_partner_applications" ("phone")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_partner_applications_status" ON "sales_partner_applications" ("status")`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sales_partner_applications_open_phone"
      ON "sales_partner_applications" ("phone")
      WHERE "status" IN ('PENDING_OTP', 'PENDING_REVIEW', 'NEEDS_INFORMATION')
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_audit_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actorUserId" uuid,
        "action" varchar(40) NOT NULL,
        "targetType" varchar(40) NOT NULL,
        "targetId" varchar(64) NOT NULL,
        "payload" jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_partner_audit_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_partner_audit_target" ON "sales_partner_audit_events" ("targetType", "targetId")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_commission_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scope" varchar(24) NOT NULL,
        "percent" integer NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "startsAt" TIMESTAMPTZ,
        "endsAt" TIMESTAMPTZ,
        "productId" uuid,
        "categoryId" uuid,
        "salesPartnerId" uuid,
        "version" integer NOT NULL DEFAULT 1,
        "createdBy" uuid,
        "note" varchar(240),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_commission_rules" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_product_eligibility" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "productId" uuid NOT NULL,
        "eligible" boolean NOT NULL DEFAULT false,
        "allowedImageKeys" jsonb,
        "marginCheck" jsonb,
        "updatedBy" uuid,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_partner_product_eligibility" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sales_partner_elig_product" UNIQUE ("productId")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_order_drafts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "salesPartnerId" uuid NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
        "customerPhone" varchar(15),
        "customerPhoneHash" varchar(64),
        "customerName" varchar(80),
        "confirmationTokenHash" varchar(64),
        "expiresAt" TIMESTAMPTZ,
        "sentCount" integer NOT NULL DEFAULT 0,
        "lastSentAt" TIMESTAMPTZ,
        "convertedOrderId" uuid,
        "estimatedCommissionIrr" integer NOT NULL DEFAULT 0,
        "merchandiseIrr" integer NOT NULL DEFAULT 0,
        "shippingFeeIrr" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_partner_order_drafts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sales_partner_drafts_order" UNIQUE ("convertedOrderId"),
        CONSTRAINT "FK_sales_partner_drafts_partner" FOREIGN KEY ("salesPartnerId") REFERENCES "sales_partner_profiles"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_order_draft_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "draftId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "variantId" uuid,
        "quantity" integer NOT NULL,
        "unitPriceIrr" integer NOT NULL,
        "lineTotalIrr" integer NOT NULL,
        "estimatedCommissionIrr" integer NOT NULL,
        "productName" varchar(160),
        CONSTRAINT "PK_sales_partner_order_draft_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sales_partner_draft_items_draft" FOREIGN KEY ("draftId") REFERENCES "sales_partner_order_drafts"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_commission_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "orderItemId" uuid NOT NULL,
        "salesPartnerId" uuid NOT NULL,
        "ruleId" uuid,
        "ruleVersion" integer NOT NULL,
        "percent" integer NOT NULL,
        "eligibleNetIrr" bigint NOT NULL,
        "commissionIrr" bigint NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_commission_snapshots" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sales_commission_snap_item" UNIQUE ("orderItemId")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_commission_ledger_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "salesPartnerId" uuid NOT NULL,
        "orderId" uuid,
        "orderItemId" uuid,
        "amountIrr" bigint NOT NULL,
        "entryType" varchar(32) NOT NULL,
        "availableAt" TIMESTAMPTZ,
        "idempotencyKey" varchar(120) NOT NULL,
        "reasonCode" varchar(40),
        "createdBy" uuid,
        "payoutId" uuid,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_commission_ledger" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sales_commission_ledger_idemp" UNIQUE ("idempotencyKey")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_commission_ledger_partner" ON "sales_commission_ledger_entries" ("salesPartnerId")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_payouts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "salesPartnerId" uuid NOT NULL,
        "status" varchar(24) NOT NULL DEFAULT 'DRAFT',
        "amountIrr" bigint NOT NULL,
        "bankReference" varchar(80),
        "method" varchar(40),
        "paidAt" TIMESTAMPTZ,
        "createdBy" uuid NOT NULL,
        "note" varchar(240),
        "receiptKey" varchar(240),
        "idempotencyKey" varchar(80) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_partner_payouts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sales_partner_payouts_idemp" UNIQUE ("idempotencyKey")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales_partner_payout_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "payoutId" uuid NOT NULL,
        "ledgerEntryId" uuid NOT NULL,
        "amountIrr" bigint NOT NULL,
        CONSTRAINT "PK_sales_partner_payout_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sales_partner_payout_ledger" UNIQUE ("ledgerEntryId"),
        CONSTRAINT "FK_sales_partner_payout_items_payout" FOREIGN KEY ("payoutId") REFERENCES "sales_partner_payouts"("id") ON DELETE RESTRICT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_partner_payout_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_partner_payouts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_commission_ledger_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_commission_snapshots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_partner_order_draft_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_partner_order_drafts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_partner_product_eligibility"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_commission_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_partner_audit_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_partner_applications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales_partner_profiles"`);
  }
}

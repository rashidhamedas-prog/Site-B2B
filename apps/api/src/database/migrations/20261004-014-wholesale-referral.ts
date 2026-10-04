import { MigrationInterface, QueryRunner } from 'typeorm';

/** Expand-only tables for the wholesale boutique referral program. */
export class WholesaleReferral1759603200001 implements MigrationInterface {
  name = 'WholesaleReferral1759603200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wholesale_referral_partners" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "phone" varchar(20) NOT NULL,
        "displayName" varchar(120) NOT NULL,
        "userId" uuid,
        "publicCode" varchar(8),
        "status" varchar(32) NOT NULL DEFAULT 'PENDING_PHONE',
        "termsVersion" varchar(40),
        "termsAcceptedAt" timestamptz,
        "payoutIban" varchar(34),
        "payoutBeneficiary" varchar(120),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_wr_partner_phone" UNIQUE ("phone")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_wr_partner_user"
      ON "wholesale_referral_partners" ("userId") WHERE "userId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_wr_partner_code"
      ON "wholesale_referral_partners" ("publicCode") WHERE "publicCode" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wholesale_referral_introductions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "partnerId" uuid NOT NULL,
        "normalizedPhone" varchar(20) NOT NULL,
        "customerId" uuid,
        "orderId" uuid,
        "source" varchar(16) NOT NULL,
        "consentToShareContact" boolean NOT NULL DEFAULT false,
        "consentAt" timestamptz,
        "stage" varchar(32) NOT NULL DEFAULT 'SUBMITTED',
        "ownershipStatus" varchar(32) NOT NULL DEFAULT 'AWAITING_POLICY',
        "reasonCode" varchar(40),
        "partnerExplanation" varchar(500),
        "internalNote" text,
        "nextAction" varchar(240),
        "assignedStaffId" uuid,
        "acquiredAt" timestamptz,
        "expiresAt" timestamptz,
        "boutiqueName" varchar(160),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wr_intro_partner"
      ON "wholesale_referral_introductions" ("partnerId", "updatedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wr_intro_phone"
      ON "wholesale_referral_introductions" ("normalizedPhone")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_wr_intro_one_owner"
      ON "wholesale_referral_introductions" ("normalizedPhone")
      WHERE "ownershipStatus" = 'OWNED'
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wholesale_referral_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "introductionId" uuid NOT NULL,
        "fromStage" varchar(32),
        "toStage" varchar(32) NOT NULL,
        "reasonCode" varchar(40),
        "partnerExplanation" varchar(500),
        "internalNote" text,
        "actorUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wholesale_referral_ledger_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "partnerId" uuid NOT NULL,
        "introductionId" uuid NOT NULL,
        "orderId" uuid,
        "entryType" varchar(40) NOT NULL,
        "bucket" varchar(16) NOT NULL,
        "amount" bigint NOT NULL,
        "idempotencyKey" varchar(160) NOT NULL,
        "ruleSnapshot" jsonb,
        "reversesEntryId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_wr_ledger_key" UNIQUE ("idempotencyKey")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wholesale_referral_disputes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "introductionId" uuid NOT NULL,
        "partnerId" uuid NOT NULL,
        "message" varchar(1000) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'OPEN',
        "resolution" varchar(1000),
        "resolvedByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wholesale_referral_audits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actorUserId" uuid,
        "action" varchar(40) NOT NULL,
        "entityType" varchar(40) NOT NULL,
        "entityId" varchar(64) NOT NULL,
        "payload" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wholesale_referral_terms_acceptances" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "partnerId" uuid NOT NULL,
        "termsVersion" varchar(40) NOT NULL,
        "acceptedAt" timestamptz NOT NULL,
        "phoneVerifiedAt" timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wholesale_referral_clicks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "publicCode" varchar(8) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wholesale_referral_clicks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wholesale_referral_terms_acceptances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wholesale_referral_audits"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wholesale_referral_disputes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wholesale_referral_ledger_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wholesale_referral_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wholesale_referral_introductions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wholesale_referral_partners"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 2: provider-agnostic registry table + seed ZarinPal APPROVED, BNPL NOT_STARTED disabled. */
export class PaymentProvidersRegistry1755018000001 implements MigrationInterface {
  name = 'PaymentProvidersRegistry1755018000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_providers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar NOT NULL UNIQUE,
        "displayName" varchar NOT NULL,
        "type" varchar NOT NULL DEFAULT 'PSP',
        "enabled" boolean NOT NULL DEFAULT false,
        "channel" varchar NOT NULL DEFAULT 'BOTH',
        "capabilities" jsonb NOT NULL DEFAULT '{}',
        "configReference" varchar NULL,
        "minAmountIrr" bigint NULL,
        "maxAmountIrr" bigint NULL,
        "supportedCategories" jsonb NULL,
        "sortOrder" int NOT NULL DEFAULT 100,
        "healthStatus" varchar NOT NULL DEFAULT 'UNKNOWN',
        "contractStatus" varchar NOT NULL DEFAULT 'NOT_STARTED',
        "maintenanceMode" boolean NOT NULL DEFAULT false,
        "lastErrorSanitized" text NULL,
        "logoUrl" varchar NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      INSERT INTO "payment_providers"
        ("code","displayName","type","enabled","channel","capabilities","configReference","sortOrder","healthStatus","contractStatus")
      VALUES
        ('ZARINPAL','زرین‌پال','PSP', true, 'BOTH',
         '{"pay":true,"bnpl":false,"refund":false,"partialRefund":false,"webhook":false}'::jsonb,
         'ZARINPAL_MERCHANT_ID', 10, 'HEALTHY', 'APPROVED'),
        ('MANUAL','ثبت دستی','MANUAL', true, 'BOTH',
         '{"pay":true,"bnpl":false,"refund":false,"partialRefund":false,"webhook":false}'::jsonb,
         NULL, 90, 'HEALTHY', 'APPROVED'),
        ('SNAPPAY','اسنپ‌پی','BNPL', false, 'BOTH',
         '{"pay":true,"bnpl":true,"refund":true,"partialRefund":false,"webhook":true}'::jsonb,
         'SNAPPAY_CREDENTIALS', 40, 'UNKNOWN', 'NOT_STARTED'),
        ('DIGIPAY','دیجی‌پی','BNPL', false, 'BOTH',
         '{"pay":true,"bnpl":true,"refund":true,"partialRefund":false,"webhook":true}'::jsonb,
         'DIGIPAY_CREDENTIALS', 50, 'UNKNOWN', 'NOT_STARTED'),
        ('TARA','تارا','BNPL', false, 'BOTH',
         '{"pay":true,"bnpl":true,"refund":true,"partialRefund":false,"webhook":true}'::jsonb,
         'TARA_CREDENTIALS', 60, 'UNKNOWN', 'NOT_STARTED'),
        ('AZKIVAM','ازکی‌وام','BNPL', false, 'BOTH',
         '{"pay":true,"bnpl":true,"refund":true,"partialRefund":false,"webhook":true}'::jsonb,
         'AZKIVAM_CREDENTIALS', 70, 'UNKNOWN', 'NOT_STARTED')
      ON CONFLICT ("code") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_providers"`);
  }
}

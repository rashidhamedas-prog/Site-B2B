import { MigrationInterface, QueryRunner } from 'typeorm';

/** Enable DigiPay UPG as the retail PSP (IPG/wallet hosted by DigiPay). Wholesale stays ZarinPal. */
export class DigipayUpgRetail1756051200001 implements MigrationInterface {
  name = 'DigipayUpgRetail1756051200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "payment_providers"
      SET
        "displayName" = 'دیجی‌پی',
        "type" = 'PSP',
        "enabled" = true,
        "channel" = 'RETAIL',
        "capabilities" = '{"pay":true,"bnpl":false,"refund":true,"partialRefund":true,"webhook":false}'::jsonb,
        "configReference" = 'DIGIPAY_CLIENT_ID',
        "sortOrder" = 5,
        "healthStatus" = 'UNKNOWN',
        "contractStatus" = 'APPROVED',
        "maintenanceMode" = false,
        "updatedAt" = now()
      WHERE "code" = 'DIGIPAY'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "payment_providers"
      SET
        "displayName" = 'دیجی‌پی',
        "type" = 'BNPL',
        "enabled" = false,
        "channel" = 'BOTH',
        "capabilities" = '{"pay":true,"bnpl":true,"refund":true,"partialRefund":false,"webhook":true}'::jsonb,
        "configReference" = 'DIGIPAY_CREDENTIALS',
        "sortOrder" = 50,
        "healthStatus" = 'UNKNOWN',
        "contractStatus" = 'NOT_STARTED',
        "maintenanceMode" = false,
        "updatedAt" = now()
      WHERE "code" = 'DIGIPAY'
    `);
  }
}

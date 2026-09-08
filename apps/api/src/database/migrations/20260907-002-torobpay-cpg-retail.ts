import { MigrationInterface, QueryRunner } from 'typeorm';

/** Enable TorobPay CPG as a retail installment PSP. Wholesale stays ZarinPal. */
export class TorobpayCpgRetail1757224800001 implements MigrationInterface {
  name = 'TorobpayCpgRetail1757224800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "payment_providers"
        ("code","displayName","type","enabled","channel","capabilities","configReference","sortOrder","healthStatus","contractStatus","maintenanceMode","updatedAt")
      VALUES
        ('TOROBPAY','ترب‌پی','BNPL', true, 'RETAIL',
         '{"pay":true,"bnpl":true,"refund":false,"partialRefund":false,"webhook":false}'::jsonb,
         'TOROBPAY_CLIENT_ID', 6, 'UNKNOWN', 'APPROVED', false, now())
      ON CONFLICT ("code") DO UPDATE SET
        "displayName" = EXCLUDED."displayName",
        "type" = EXCLUDED."type",
        "enabled" = true,
        "channel" = 'RETAIL',
        "capabilities" = EXCLUDED."capabilities",
        "configReference" = EXCLUDED."configReference",
        "sortOrder" = EXCLUDED."sortOrder",
        "contractStatus" = 'APPROVED',
        "maintenanceMode" = false,
        "updatedAt" = now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "payment_providers"
      SET
        "enabled" = false,
        "contractStatus" = 'NOT_STARTED',
        "updatedAt" = now()
      WHERE "code" = 'TOROBPAY'
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class VendorLedger1757433600016 implements MigrationInterface {
  name = 'VendorLedger1757433600016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fulfillment_orders"
        ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vendor_ledger_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vendorId" uuid NOT NULL,
        "fulfillmentOrderId" uuid NOT NULL,
        "orderId" uuid NOT NULL,
        "entryType" varchar(32) NOT NULL DEFAULT 'COMMISSION_ACCRUAL',
        "amountIrr" bigint NOT NULL,
        "availableAt" TIMESTAMPTZ NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'HELD',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vendor_ledger_entries_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vendor_ledger_fulfillment_accrual" UNIQUE ("fulfillmentOrderId", "entryType"),
        CONSTRAINT "FK_vendor_ledger_vendorId" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_vendor_ledger_fulfillmentOrderId" FOREIGN KEY ("fulfillmentOrderId") REFERENCES "fulfillment_orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_vendor_ledger_orderId" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vendor_ledger_vendorId" ON "vendor_ledger_entries" ("vendorId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vendor_ledger_status_available" ON "vendor_ledger_entries" ("status", "availableAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vendor_ledger_entries"`);
    await queryRunner.query(`ALTER TABLE "fulfillment_orders" DROP COLUMN IF EXISTS "deliveredAt"`);
  }
}

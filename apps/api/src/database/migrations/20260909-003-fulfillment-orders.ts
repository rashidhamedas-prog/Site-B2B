import { MigrationInterface, QueryRunner } from 'typeorm';

export class FulfillmentOrders1757404800003 implements MigrationInterface {
  name = 'FulfillmentOrders1757404800003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order_items"
        ADD COLUMN IF NOT EXISTS "vendorId" uuid,
        ADD COLUMN IF NOT EXISTS "commissionPercent" integer
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_order_items_vendorId" ON "order_items" ("vendorId")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fulfillment_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "vendorId" uuid,
        "parcelIndex" integer NOT NULL,
        "parcelLabel" varchar(32) NOT NULL,
        "status" varchar(24) NOT NULL DEFAULT 'PENDING_ACCEPT',
        "acceptBy" TIMESTAMPTZ,
        "goodsTotal" bigint NOT NULL DEFAULT 0,
        "shippingFee" bigint NOT NULL DEFAULT 0,
        "commissionTotal" bigint NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fulfillment_orders_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_fulfillment_orders_order_parcel" UNIQUE ("orderId", "parcelIndex"),
        CONSTRAINT "FK_fulfillment_orders_orderId" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_fulfillment_orders_vendorId" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_fulfillment_orders_order_vendor"
        ON "fulfillment_orders" ("orderId", COALESCE("vendorId", '00000000-0000-0000-0000-000000000000'))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fulfillment_orders_vendorId" ON "fulfillment_orders" ("vendorId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fulfillment_orders_orderId" ON "fulfillment_orders" ("orderId")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fulfillment_order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fulfillmentOrderId" uuid NOT NULL,
        "orderItemId" uuid NOT NULL,
        "productName" varchar NOT NULL,
        "sku" varchar NOT NULL,
        "color" varchar NOT NULL,
        "size" varchar NOT NULL,
        "imageUrl" varchar,
        "quantity" integer NOT NULL,
        "lineTotal" bigint NOT NULL,
        "commissionPercent" integer,
        "commissionAmount" bigint NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fulfillment_order_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_foi_fulfillmentOrderId" FOREIGN KEY ("fulfillmentOrderId") REFERENCES "fulfillment_orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_foi_orderItemId" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_foi_fulfillmentOrderId" ON "fulfillment_order_items" ("fulfillmentOrderId")
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "order_items"
          ADD CONSTRAINT "FK_order_items_vendorId"
          FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "FK_order_items_vendorId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fulfillment_order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fulfillment_orders"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_items_vendorId"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "commissionPercent"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "vendorId"`);
  }
}

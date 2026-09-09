import { MigrationInterface, QueryRunner } from 'typeorm';

export class FulfillmentTracking1757412000004 implements MigrationInterface {
  name = 'FulfillmentTracking1757412000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fulfillment_orders"
        ADD COLUMN IF NOT EXISTS "trackingCode" varchar(64)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fulfillment_orders" DROP COLUMN IF EXISTS "trackingCode"
    `);
  }
}

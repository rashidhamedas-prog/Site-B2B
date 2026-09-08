import { MigrationInterface, QueryRunner } from 'typeorm';

export class MarketingCheckoutIntent1757332800004 implements MigrationInterface {
  name = 'MarketingCheckoutIntent1757332800004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_checkout_intents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customerId" varchar NOT NULL,
        "channel" varchar(16) NOT NULL,
        "startedAt" TIMESTAMPTZ NOT NULL,
        "completedOrderId" uuid,
        "completedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketing_checkout_intents_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_checkout_intents_customer_channel"
      ON "marketing_checkout_intents" ("customerId", "channel")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_marketing_checkout_intents_started"
      ON "marketing_checkout_intents" ("channel", "startedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_marketing_checkout_intents_started"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_marketing_checkout_intents_customer_channel"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_checkout_intents"`);
  }
}

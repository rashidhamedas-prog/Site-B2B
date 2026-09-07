import { MigrationInterface, QueryRunner } from 'typeorm';

export class CartSmsOps1757289600001 implements MigrationInterface {
  name = 'CartSmsOps1757289600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cart_signals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel" varchar(10) NOT NULL,
        "sessionId" varchar(80) NOT NULL,
        "phone" varchar(16) NOT NULL DEFAULT '',
        "items" jsonb NOT NULL DEFAULT '[]',
        "lastItemAt" TIMESTAMPTZ NOT NULL,
        "reminderSentAt" TIMESTAMPTZ NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cart_signals_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cart_signals_channel_session"
      ON "cart_signals" ("channel", "sessionId")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_event_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "eventKey" varchar(160) NOT NULL,
        "event" varchar(40) NOT NULL,
        "channel" varchar(10) NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sms_event_log_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sms_event_log_event_key"
      ON "sms_event_log" ("eventKey")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_event_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cart_signals"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-14: ALTER PR-13 bot conversation/message tables for FSM + idempotency.
 * Additive only — never recreates omnichannel_bot_* tables.
 * Iran: listable Postgres dump before apply (Owner GO).
 */
export class OmnichannelOrderBots1761836400001 implements MigrationInterface {
  name = 'OmnichannelOrderBots1761836400001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "omnichannel_bot_conversations"
        ADD COLUMN IF NOT EXISTS "connectionId" uuid NULL,
        ADD COLUMN IF NOT EXISTS "externalChatId" varchar(128) NULL,
        ADD COLUMN IF NOT EXISTS "state" varchar(32) NOT NULL DEFAULT 'MENU',
        ADD COLUMN IF NOT EXISTS "statePayload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "unansweredSince" timestamptz NULL,
        ADD COLUMN IF NOT EXISTS "autoRepliedAt" timestamptz NULL,
        ADD COLUMN IF NOT EXISTS "lastInboundAt" timestamptz NULL,
        ADD COLUMN IF NOT EXISTS "lastOutboundAt" timestamptz NULL,
        ADD COLUMN IF NOT EXISTS "orderId" uuid NULL,
        ADD COLUMN IF NOT EXISTS "invoiceId" uuid NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_bot_conversations_open_dest_customer"
      ON "omnichannel_bot_conversations" ("destinationId", "customerChatId")
      WHERE "status" = 'open'
    `);

    await queryRunner.query(`
      ALTER TABLE "omnichannel_bot_messages"
        ADD COLUMN IF NOT EXISTS "provider" varchar(32) NULL,
        ADD COLUMN IF NOT EXISTS "body" text NULL,
        ADD COLUMN IF NOT EXISTS "meta" jsonb NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_bot_messages_provider_msgid"
      ON "omnichannel_bot_messages" ("provider", "providerMessageId")
      WHERE "providerMessageId" IS NOT NULL AND "provider" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_omnichannel_bot_messages_provider_msgid"`);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_bot_messages"
        DROP COLUMN IF EXISTS "meta",
        DROP COLUMN IF EXISTS "body",
        DROP COLUMN IF EXISTS "provider"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_omnichannel_bot_conversations_open_dest_customer"`);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_bot_conversations"
        DROP COLUMN IF EXISTS "invoiceId",
        DROP COLUMN IF EXISTS "orderId",
        DROP COLUMN IF EXISTS "lastOutboundAt",
        DROP COLUMN IF EXISTS "lastInboundAt",
        DROP COLUMN IF EXISTS "autoRepliedAt",
        DROP COLUMN IF EXISTS "unansweredSince",
        DROP COLUMN IF EXISTS "tags",
        DROP COLUMN IF EXISTS "statePayload",
        DROP COLUMN IF EXISTS "state",
        DROP COLUMN IF EXISTS "externalChatId",
        DROP COLUMN IF EXISTS "connectionId"
    `);
  }
}

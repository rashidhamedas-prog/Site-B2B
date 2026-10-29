import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-13: bot conversation/message store + unanswered alerts (additive).
 * Iran: listable Postgres dump before apply (Owner GO).
 */
export class OmnichannelUnansweredAlerts1761750000001 implements MigrationInterface {
  name = 'OmnichannelUnansweredAlerts1761750000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_bot_conversations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "destinationId" uuid NOT NULL,
        "provider" varchar(32) NOT NULL,
        "customerChatId" varchar(128) NOT NULL,
        "lastCustomerMessageAt" timestamptz NULL,
        "lastStaffReplyAt" timestamptz NULL,
        "status" varchar(16) NOT NULL DEFAULT 'open',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_omnichannel_bot_conversations_destination"
          FOREIGN KEY ("destinationId") REFERENCES "omnichannel_channel_destinations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_omnichannel_bot_conversations_dest_status"
      ON "omnichannel_bot_conversations" ("destinationId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_omnichannel_bot_conversations_last_customer"
      ON "omnichannel_bot_conversations" ("lastCustomerMessageAt")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_bot_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "conversationId" uuid NOT NULL,
        "direction" varchar(16) NOT NULL,
        "bodyPreview" varchar(200) NOT NULL DEFAULT '',
        "providerMessageId" varchar(128) NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_omnichannel_bot_messages_conversation"
          FOREIGN KEY ("conversationId") REFERENCES "omnichannel_bot_conversations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_omnichannel_bot_messages_conversation"
      ON "omnichannel_bot_messages" ("conversationId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_alerts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" varchar(32) NOT NULL DEFAULT 'bot_unanswered',
        "destinationId" uuid NOT NULL,
        "conversationId" uuid NOT NULL,
        "severity" varchar(16) NOT NULL DEFAULT 'warn',
        "status" varchar(16) NOT NULL DEFAULT 'open',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "notifiedOwnerAt" timestamptz NULL,
        "panelSeenAt" timestamptz NULL,
        "detail" jsonb NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT "FK_omnichannel_alerts_destination"
          FOREIGN KEY ("destinationId") REFERENCES "omnichannel_channel_destinations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_omnichannel_alerts_conversation"
          FOREIGN KEY ("conversationId") REFERENCES "omnichannel_bot_conversations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_omnichannel_alerts_status_created"
      ON "omnichannel_alerts" ("status", "createdAt")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_alerts_open_conversation"
      ON "omnichannel_alerts" ("conversationId")
      WHERE "status" IN ('open', 'acked') AND "type" = 'bot_unanswered'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_omnichannel_alerts_open_conversation"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_omnichannel_alerts_status_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_alerts"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_omnichannel_bot_messages_conversation"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_bot_messages"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_omnichannel_bot_conversations_last_customer"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_omnichannel_bot_conversations_dest_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_bot_conversations"`);
  }
}

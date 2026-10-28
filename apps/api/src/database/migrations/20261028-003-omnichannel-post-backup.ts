import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-7: post_backup + delivery_message tables (additive).
 * Numbered 003 so it sorts after PR-6 audit/rbac (002) when that lands on master.
 * Iran: run scripts/backup-postgres.sh and record the dump path before applying.
 */
export class OmnichannelPostBackup1761631200001 implements MigrationInterface {
  name = 'OmnichannelPostBackup1761631200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_post_backups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "deliveryId" uuid NOT NULL,
        "publicationId" uuid NOT NULL,
        "destinationId" uuid NOT NULL,
        "kind" varchar NOT NULL,
        "caption" text NULL,
        "mediaUrls" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "messageIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "contentHash" varchar NULL,
        "reason" text NULL,
        "actorId" uuid NOT NULL,
        "goRef" varchar NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_omnichannel_post_backups_delivery"
          FOREIGN KEY ("deliveryId") REFERENCES "omnichannel_publication_deliveries"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_omnichannel_post_backups_delivery_created"
      ON "omnichannel_post_backups" ("deliveryId", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_delivery_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "deliveryId" uuid NOT NULL,
        "providerMessageId" varchar NOT NULL,
        "albumIndex" int NOT NULL DEFAULT 0,
        "deletedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_omnichannel_delivery_messages_delivery"
          FOREIGN KEY ("deliveryId") REFERENCES "omnichannel_publication_deliveries"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_delivery_messages_delivery_msg"
      ON "omnichannel_delivery_messages" ("deliveryId", "providerMessageId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_omnichannel_delivery_messages_delivery"
      ON "omnichannel_delivery_messages" ("deliveryId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_omnichannel_delivery_messages_delivery"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_omnichannel_delivery_messages_delivery_msg"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_delivery_messages"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_omnichannel_post_backups_delivery_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_post_backups"`);
  }
}

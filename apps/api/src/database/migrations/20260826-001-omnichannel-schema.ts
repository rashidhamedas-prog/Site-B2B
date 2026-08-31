import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive Omnichannel tables. Feature stays off; no safety-net SQL outside this migration. */
export class OmnichannelSchema1756224000001 implements MigrationInterface {
  name = 'OmnichannelSchema1756224000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_channel_connections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "provider" varchar NOT NULL,
        "channel" varchar NOT NULL,
        "name" varchar NOT NULL,
        "secretRef" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'DISABLED',
        "lastCheckedAt" TIMESTAMPTZ,
        "lastError" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_connections_provider_channel_name"
      ON "omnichannel_channel_connections" ("provider", "channel", "name")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_channel_destinations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "connectionId" uuid NOT NULL,
        "destinationKey" varchar NOT NULL,
        "displayName" varchar NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_omnichannel_destinations_connectionId"
          FOREIGN KEY ("connectionId") REFERENCES "omnichannel_channel_connections"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_destinations_connection_key"
      ON "omnichannel_channel_destinations" ("connectionId", "destinationKey")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_channel_templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "provider" varchar NOT NULL,
        "channel" varchar NOT NULL,
        "eventType" varchar NOT NULL,
        "locale" varchar NOT NULL DEFAULT 'fa',
        "body" text NOT NULL,
        "version" int NOT NULL DEFAULT 1,
        "enabled" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_templates_provider_channel_event_version"
      ON "omnichannel_channel_templates" ("provider", "channel", "eventType", "version")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_outbox_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventType" varchar NOT NULL,
        "aggregateType" varchar NOT NULL,
        "aggregateId" varchar NOT NULL,
        "channel" varchar,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "dedupeKey" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "attempts" int NOT NULL DEFAULT 0,
        "maxAttempts" int NOT NULL DEFAULT 8,
        "availableAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "lockedAt" TIMESTAMPTZ,
        "lockedBy" varchar,
        "lastError" text,
        "completedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_outbox_dedupeKey"
      ON "omnichannel_outbox_events" ("dedupeKey")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_omnichannel_outbox_status_availableAt"
      ON "omnichannel_outbox_events" ("status", "availableAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_omnichannel_outbox_aggregate"
      ON "omnichannel_outbox_events" ("aggregateType", "aggregateId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_publications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sourceType" varchar NOT NULL,
        "sourceId" varchar NOT NULL,
        "channel" varchar NOT NULL,
        "sourceUpdatedAt" TIMESTAMPTZ NOT NULL,
        "projection" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_publications_source_channel_updated"
      ON "omnichannel_publications" ("sourceType", "sourceId", "channel", "sourceUpdatedAt")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_publication_deliveries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "publicationId" uuid NOT NULL,
        "destinationId" uuid NOT NULL,
        "eventId" uuid NOT NULL,
        "action" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "providerMessageId" varchar,
        "attempts" int NOT NULL DEFAULT 0,
        "nextAttemptAt" TIMESTAMPTZ,
        "lastError" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_omnichannel_deliveries_publicationId"
          FOREIGN KEY ("publicationId") REFERENCES "omnichannel_publications"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "FK_omnichannel_deliveries_destinationId"
          FOREIGN KEY ("destinationId") REFERENCES "omnichannel_channel_destinations"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "FK_omnichannel_deliveries_eventId"
          FOREIGN KEY ("eventId") REFERENCES "omnichannel_outbox_events"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_deliveries_event_destination_action"
      ON "omnichannel_publication_deliveries" ("eventId", "destinationId", "action")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_publication_deliveries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_publications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_outbox_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_channel_templates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_channel_destinations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_channel_connections"`);
  }
}

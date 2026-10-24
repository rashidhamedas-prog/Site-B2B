import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Destination-scoped publish settings + templates.
 * Backfill: copy connection.publishSettings → each destination; attach/clone
 * per-bot templates onto destinations (single-dest attach, multi-dest clone).
 */
export class DestinationPublishSettings1761264000001 implements MigrationInterface {
  name = 'DestinationPublishSettings1761264000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "omnichannel_channel_destinations"
      ADD COLUMN IF NOT EXISTS "publishSettings" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "omnichannel_channel_templates"
      ADD COLUMN IF NOT EXISTS "destinationId" uuid
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "omnichannel_channel_templates"
          ADD CONSTRAINT "FK_omnichannel_templates_destinationId"
          FOREIGN KEY ("destinationId") REFERENCES "omnichannel_channel_destinations"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // Connection unique only for rows without destination binding.
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_omnichannel_templates_connection_event_version"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_templates_connection_event_version"
      ON "omnichannel_channel_templates" ("connectionId", "eventType", "version")
      WHERE "connectionId" IS NOT NULL AND "destinationId" IS NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_omnichannel_templates_fallback_provider_channel_event_version"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_templates_fallback_provider_channel_event_version"
      ON "omnichannel_channel_templates" ("provider", "channel", "eventType", "version")
      WHERE "connectionId" IS NULL AND "destinationId" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_templates_destination_event_version"
      ON "omnichannel_channel_templates" ("destinationId", "eventType", "version")
      WHERE "destinationId" IS NOT NULL
    `);

    // Seed destination publishSettings from parent connection.
    await queryRunner.query(`
      UPDATE "omnichannel_channel_destinations" AS d
      SET "publishSettings" = COALESCE(c."publishSettings", '{}'::jsonb)
      FROM "omnichannel_channel_connections" AS c
      WHERE c.id = d."connectionId"
        AND (d."publishSettings" = '{}'::jsonb OR d."publishSettings" IS NULL)
    `);

    // Single-destination connections: attach existing per-bot templates.
    await queryRunner.query(`
      UPDATE "omnichannel_channel_templates" AS t
      SET "destinationId" = d.id
      FROM (
        SELECT c.id AS "connectionId", MIN(d.id::text)::uuid AS id
        FROM "omnichannel_channel_connections" c
        INNER JOIN "omnichannel_channel_destinations" d ON d."connectionId" = c.id
        GROUP BY c.id
        HAVING COUNT(*) = 1
      ) AS d
      WHERE t."connectionId" = d."connectionId"
        AND t."destinationId" IS NULL
    `);

    // Multi-destination: clone each per-bot template once per sibling destination.
    await queryRunner.query(`
      INSERT INTO "omnichannel_channel_templates" (
        id, provider, channel, "connectionId", "destinationId", "eventType", locale, body, version, enabled, "createdAt", "updatedAt"
      )
      SELECT
        gen_random_uuid(),
        t.provider,
        t.channel,
        t."connectionId",
        d.id,
        t."eventType",
        t.locale,
        t.body,
        t.version,
        t.enabled,
        NOW(),
        NOW()
      FROM "omnichannel_channel_templates" t
      INNER JOIN "omnichannel_channel_destinations" d ON d."connectionId" = t."connectionId"
      WHERE t."connectionId" IS NOT NULL
        AND t."destinationId" IS NULL
        AND EXISTS (
          SELECT 1
          FROM "omnichannel_channel_destinations" d2
          WHERE d2."connectionId" = t."connectionId"
          GROUP BY d2."connectionId"
          HAVING COUNT(*) > 1
        )
        AND NOT EXISTS (
          SELECT 1 FROM "omnichannel_channel_templates" x
          WHERE x."destinationId" = d.id
            AND x."eventType" = t."eventType"
            AND x.version = t.version
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_omnichannel_templates_destination_event_version"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_omnichannel_templates_connection_event_version"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_omnichannel_templates_fallback_provider_channel_event_version"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_templates_connection_event_version"
      ON "omnichannel_channel_templates" ("connectionId", "eventType", "version")
      WHERE "connectionId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_templates_fallback_provider_channel_event_version"
      ON "omnichannel_channel_templates" ("provider", "channel", "eventType", "version")
      WHERE "connectionId" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_channel_templates"
      DROP CONSTRAINT IF EXISTS "FK_omnichannel_templates_destinationId"
    `);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_channel_templates"
      DROP COLUMN IF EXISTS "destinationId"
    `);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_channel_destinations"
      DROP COLUMN IF EXISTS "publishSettings"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-bot × platform publish settings on connections; templates may bind to a connection.
 * Backfill copies legacy global automation/OOS into each connection's publishSettings.
 */
export class ConnectionPublishSettings1760438400001 implements MigrationInterface {
  name = 'ConnectionPublishSettings1760438400001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "omnichannel_channel_connections"
      ADD COLUMN IF NOT EXISTS "publishSettings" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "omnichannel_channel_templates"
      ADD COLUMN IF NOT EXISTS "connectionId" uuid
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "omnichannel_channel_templates"
          ADD CONSTRAINT "FK_omnichannel_templates_connectionId"
          FOREIGN KEY ("connectionId") REFERENCES "omnichannel_channel_connections"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // Replace global unique with partials so per-bot templates can coexist with channel fallbacks.
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_omnichannel_templates_provider_channel_event_version"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_templates_fallback_provider_channel_event_version"
      ON "omnichannel_channel_templates" ("provider", "channel", "eventType", "version")
      WHERE "connectionId" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_templates_connection_event_version"
      ON "omnichannel_channel_templates" ("connectionId", "eventType", "version")
      WHERE "connectionId" IS NOT NULL
    `);

    // Seed each connection from the single global omnichannel settings blob (if present).
    await queryRunner.query(`
      UPDATE "omnichannel_channel_connections" AS c
      SET "publishSettings" = COALESCE(
        (
          SELECT jsonb_strip_nulls(jsonb_build_object(
            'autoPublishMode', s.value->>'autoPublishMode',
            'autoDailyCap', (s.value->>'autoDailyCap')::int,
            'autoMinGapSeconds', (s.value->>'autoMinGapSeconds')::int,
            'quietStartHour', (s.value->>'quietStartHour')::int,
            'quietEndHour', (s.value->>'quietEndHour')::int,
            'withdrawAction', s.value->>'withdrawAction',
            'autoPublishCategoryIds', s.value->'autoPublishCategoryIds',
            'autoPublishEventTypes', s.value->'autoPublishEventTypes',
            'autoPublishEventTypesChosen', s.value->'autoPublishEventTypesChosen',
            'oosPolicy', CASE
              WHEN c.channel = 'WHOLESALE' THEN s.value->>'wholesaleOosPolicy'
              ELSE s.value->>'retailOosPolicy'
            END,
            'oosChosen', CASE
              WHEN c.channel = 'WHOLESALE' THEN s.value->'wholesaleOosChosen'
              ELSE s.value->'retailOosChosen'
            END,
            'seeded', false
          ))
          FROM "app_settings" s
          WHERE s.key = 'omnichannel'
          LIMIT 1
        ),
        '{}'::jsonb
      )
      WHERE c."publishSettings" = '{}'::jsonb OR c."publishSettings" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_omnichannel_templates_connection_event_version"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_omnichannel_templates_fallback_provider_channel_event_version"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_templates_provider_channel_event_version"
      ON "omnichannel_channel_templates" ("provider", "channel", "eventType", "version")
    `);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_channel_templates"
      DROP CONSTRAINT IF EXISTS "FK_omnichannel_templates_connectionId"
    `);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_channel_templates"
      DROP COLUMN IF EXISTS "connectionId"
    `);
    await queryRunner.query(`
      ALTER TABLE "omnichannel_channel_connections"
      DROP COLUMN IF EXISTS "publishSettings"
    `);
  }
}

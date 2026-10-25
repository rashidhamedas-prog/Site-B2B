import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  ACTIVE_CREATE_INDEX_NAME,
  ACTIVE_CREATE_INDEX_PREDICATE,
  DEDUPE_UNDO_INSERT_SQL,
} from '../../modules/omnichannel/delivery-dedupe-sql';

/**
 * One active CREATE per product per destination.
 * Losers are marked DEAD + supersededAt. No delivery row is deleted.
 * Undo rows let down() restore the previous status.
 */
export class OmnichannelDeliveryIdempotency1761364800001 implements MigrationInterface {
  name = 'OmnichannelDeliveryIdempotency1761364800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "omnichannel_delivery_dedupe_undo" (
        "deliveryId" uuid PRIMARY KEY,
        "previousStatus" varchar NOT NULL,
        "previousLastError" text,
        "outboxId" uuid,
        "previousOutboxStatus" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" ADD COLUMN IF NOT EXISTS "sourceType" varchar`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" ADD COLUMN IF NOT EXISTS "sourceId" varchar`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" ADD COLUMN IF NOT EXISTS "idempotencyKey" varchar`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" ADD COLUMN IF NOT EXISTS "auto" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" ADD COLUMN IF NOT EXISTS "deferredReason" varchar`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" ADD COLUMN IF NOT EXISTS "supersededAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" ADD COLUMN IF NOT EXISTS "sentAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" ADD COLUMN IF NOT EXISTS "contentHash" varchar`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" ADD COLUMN IF NOT EXISTS "reapprovedAt" timestamptz`);

    await queryRunner.query(`
      UPDATE "omnichannel_publication_deliveries" d
      SET
        "sourceType" = p."sourceType",
        "sourceId" = p."sourceId",
        "idempotencyKey" = CASE
          WHEN d.action = 'CREATE' THEN 'CREATE:' || p."sourceType" || ':' || p."sourceId" || ':' || d."destinationId"::text
          ELSE d.action || ':' || d."destinationId"::text || ':' || COALESCE(d."providerMessageId", '') || ':'
        END,
        "sentAt" = CASE
          WHEN d.status = 'SUCCEEDED' AND d."sentAt" IS NULL THEN d."updatedAt"
          ELSE d."sentAt"
        END
      FROM "omnichannel_publications" p
      WHERE p.id = d."publicationId"
        AND d."idempotencyKey" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "omnichannel_publication_deliveries"
      SET
        "sourceType" = COALESCE("sourceType", 'UNKNOWN'),
        "sourceId" = COALESCE("sourceId", "publicationId"::text),
        "idempotencyKey" = COALESCE(
          "idempotencyKey",
          'CREATE:UNKNOWN:' || "publicationId"::text || ':' || "destinationId"::text
        )
      WHERE "idempotencyKey" IS NULL
         OR "sourceType" IS NULL
         OR "sourceId" IS NULL
    `);

    await queryRunner.query(DEDUPE_UNDO_INSERT_SQL);

    await queryRunner.query(`
      UPDATE "omnichannel_publication_deliveries" d
      SET
        status = 'DEAD',
        "lastError" = 'superseded_duplicate',
        "supersededAt" = NOW(),
        "updatedAt" = NOW()
      FROM "omnichannel_delivery_dedupe_undo" u
      WHERE d.id = u."deliveryId"
        AND d."supersededAt" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "omnichannel_outbox_events" e
      SET
        status = 'DEAD',
        "lastError" = 'superseded_duplicate',
        "completedAt" = COALESCE(e."completedAt", NOW()),
        "lockedAt" = NULL,
        "lockedBy" = NULL,
        "updatedAt" = NOW()
      FROM "omnichannel_delivery_dedupe_undo" u
      WHERE e.id = u."outboxId"
        AND e.status <> 'DONE'
    `);

    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" ALTER COLUMN "sourceType" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" ALTER COLUMN "sourceId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" ALTER COLUMN "idempotencyKey" SET NOT NULL`);

    await queryRunner.query(`DROP INDEX IF EXISTS "${ACTIVE_CREATE_INDEX_NAME}"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "${ACTIVE_CREATE_INDEX_NAME}"
      ON "omnichannel_publication_deliveries" ("idempotencyKey")
      WHERE ${ACTIVE_CREATE_INDEX_PREDICATE}
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_omnichannel_deliveries_dest_sent"
      ON "omnichannel_publication_deliveries" ("destinationId", "sentAt")
      WHERE action = 'CREATE' AND status = 'SUCCEEDED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_omnichannel_deliveries_dest_sent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "${ACTIVE_CREATE_INDEX_NAME}"`);

    await queryRunner.query(`
      UPDATE "omnichannel_outbox_events" e
      SET
        status = u."previousOutboxStatus",
        "lastError" = NULL,
        "updatedAt" = NOW()
      FROM "omnichannel_delivery_dedupe_undo" u
      WHERE e.id = u."outboxId"
        AND u."previousOutboxStatus" IS NOT NULL
        AND e."lastError" = 'superseded_duplicate'
    `);

    await queryRunner.query(`
      UPDATE "omnichannel_publication_deliveries" d
      SET
        status = u."previousStatus",
        "lastError" = u."previousLastError",
        "supersededAt" = NULL,
        "updatedAt" = NOW()
      FROM "omnichannel_delivery_dedupe_undo" u
      WHERE d.id = u."deliveryId"
    `);

    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" DROP COLUMN IF EXISTS "reapprovedAt"`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" DROP COLUMN IF EXISTS "contentHash"`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" DROP COLUMN IF EXISTS "sentAt"`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" DROP COLUMN IF EXISTS "supersededAt"`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" DROP COLUMN IF EXISTS "deferredReason"`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" DROP COLUMN IF EXISTS "auto"`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" DROP COLUMN IF EXISTS "idempotencyKey"`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" DROP COLUMN IF EXISTS "sourceId"`);
    await queryRunner.query(`ALTER TABLE "omnichannel_publication_deliveries" DROP COLUMN IF EXISTS "sourceType"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "omnichannel_delivery_dedupe_undo"`);
  }
}

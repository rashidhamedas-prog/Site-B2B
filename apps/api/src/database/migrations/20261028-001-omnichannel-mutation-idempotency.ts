import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  ACTIVE_MUTATION_INDEX_NAME,
  ACTIVE_MUTATION_INDEX_PREDICATE,
  MUTATION_KEY_NORMALIZE_SQL,
  MUTATION_KEY_UNDO_INSERT_SQL,
  MUTATION_KEY_UNDO_TABLE,
  MUTATION_LOSER_ID_SQL,
  MUTATION_UNDO_INSERT_SQL,
} from '../../modules/omnichannel/delivery-dedupe-sql';

/**
 * PR-3 delta. At most one active UPDATE / DELETE per idempotencyKey.
 * Older active duplicates are marked DEAD + supersededAt (never deleted); the snapshot goes to
 * omnichannel_delivery_dedupe_undo (owned by 20261025-001). Active DELETE keys are normalised to the
 * no-hash format and their previous key is kept in a small undo table. down() reverses both.
 * The CREATE index, the delivery columns and the dedupe undo table are left to 20261025-001.
 */
export class OmnichannelMutationIdempotency1761609600001 implements MigrationInterface {
  name = 'OmnichannelMutationIdempotency1761609600001';

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
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${MUTATION_KEY_UNDO_TABLE}" (
        "deliveryId" uuid PRIMARY KEY,
        "previousIdempotencyKey" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // 1) Snapshot, then 2) supersede the losers. Rows stay in the table.
    await queryRunner.query(MUTATION_UNDO_INSERT_SQL);
    await queryRunner.query(`
      UPDATE "omnichannel_publication_deliveries" d
      SET
        status = 'DEAD',
        "lastError" = 'superseded_duplicate',
        "supersededAt" = NOW(),
        "updatedAt" = NOW()
      WHERE d.id IN (${MUTATION_LOSER_ID_SQL})
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
      INNER JOIN "omnichannel_publication_deliveries" d ON d.id = u."deliveryId"
      WHERE e.id = u."outboxId"
        AND d.action IN ('UPDATE', 'DELETE')
        AND d."lastError" = 'superseded_duplicate'
        AND d."supersededAt" IS NOT NULL
        AND e.status <> 'DONE'
    `);

    // 3) Normalise active DELETE keys (collision-free: one active row per normalised key remains).
    await queryRunner.query(MUTATION_KEY_UNDO_INSERT_SQL);
    await queryRunner.query(MUTATION_KEY_NORMALIZE_SQL);

    // 4) The guarantee.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "${ACTIVE_MUTATION_INDEX_NAME}"
      ON "omnichannel_publication_deliveries" ("idempotencyKey")
      WHERE ${ACTIVE_MUTATION_INDEX_PREDICATE}
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "${ACTIVE_MUTATION_INDEX_NAME}"`);

    await queryRunner.query(`
      UPDATE "omnichannel_publication_deliveries" d
      SET "idempotencyKey" = u."previousIdempotencyKey", "updatedAt" = NOW()
      FROM "${MUTATION_KEY_UNDO_TABLE}" u
      WHERE d.id = u."deliveryId"
        AND d.action = 'DELETE'
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "${MUTATION_KEY_UNDO_TABLE}"`);

    await queryRunner.query(`
      UPDATE "omnichannel_outbox_events" e
      SET
        status = u."previousOutboxStatus",
        "lastError" = NULL,
        "updatedAt" = NOW()
      FROM "omnichannel_delivery_dedupe_undo" u
      INNER JOIN "omnichannel_publication_deliveries" d ON d.id = u."deliveryId"
      WHERE e.id = u."outboxId"
        AND d.action IN ('UPDATE', 'DELETE')
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
        AND d.action IN ('UPDATE', 'DELETE')
        AND d."lastError" = 'superseded_duplicate'
    `);
    // Undo snapshot rows stay: a second up() keeps ON CONFLICT DO NOTHING and the values still match.
  }
}

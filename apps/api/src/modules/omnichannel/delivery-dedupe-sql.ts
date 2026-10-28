/**
 * Shared SQL for the delivery idempotency migration and the dry-run.
 * The partial unique predicate must match the ON CONFLICT clause exactly.
 * HOLD is included so a paused row still occupies the one CREATE slot.
 */
export const ACTIVE_CREATE_INDEX_NAME = 'UQ_omnichannel_deliveries_active_create';

export const ACTIVE_CREATE_INDEX_PREDICATE =
  `"status" IN ('PENDING','PROCESSING','RETRY','SUCCEEDED','HOLD') AND "action" = 'CREATE' AND "supersededAt" IS NULL`;

const DEDUPE_CTES = `
WITH base AS (
  SELECT
    d.id,
    d."eventId",
    d.status,
    d."lastError",
    d."createdAt",
    d."destinationId",
    d."publicationId",
    p."sourceType",
    p."sourceId"
  FROM "omnichannel_publication_deliveries" d
  INNER JOIN "omnichannel_publications" p ON p.id = d."publicationId"
  WHERE d.action = 'CREATE'
    AND d."supersededAt" IS NULL
),
keepers AS (
  SELECT DISTINCT ON ("sourceType", "sourceId", "destinationId")
    id AS keep_id
  FROM base
  ORDER BY
    "sourceType",
    "sourceId",
    "destinationId",
    CASE WHEN status = 'SUCCEEDED' THEN 0 ELSE 1 END,
    CASE WHEN status = 'SUCCEEDED' THEN "createdAt" END ASC,
    CASE WHEN status <> 'SUCCEEDED' THEN "createdAt" END DESC
)
`;

/** Oldest SUCCEEDED wins; otherwise the newest row. Everyone else is a loser. */
export const DEDUPE_LOSER_SELECT_SQL = `
${DEDUPE_CTES}
SELECT
  b.id AS "deliveryId",
  b."eventId" AS "outboxId",
  b.status AS "previousStatus",
  b."lastError" AS "previousLastError",
  b."sourceType",
  b."sourceId",
  b."destinationId",
  b."publicationId",
  b."createdAt"
FROM base b
LEFT JOIN keepers k ON k.keep_id = b.id
WHERE k.keep_id IS NULL
`;

/** Snapshot losers, then the migration UPDATEs from this table. Not a nested WITH. */
export const DEDUPE_UNDO_INSERT_SQL = `
${DEDUPE_CTES}
INSERT INTO "omnichannel_delivery_dedupe_undo"
  ("deliveryId", "previousStatus", "previousLastError", "outboxId", "previousOutboxStatus")
SELECT
  b.id,
  b.status,
  b."lastError",
  b."eventId",
  e.status
FROM base b
LEFT JOIN keepers k ON k.keep_id = b.id
LEFT JOIN "omnichannel_outbox_events" e ON e.id = b."eventId"
WHERE k.keep_id IS NULL
ON CONFLICT ("deliveryId") DO NOTHING
`;

export const DRY_RUN_REPORT_SQL = `
${DEDUPE_CTES}
SELECT
  b.id AS "deliveryId",
  pr.sku AS sku,
  b."sourceType",
  b."sourceId",
  b."destinationId",
  b.status AS "previousStatus",
  b."createdAt"
FROM base b
LEFT JOIN keepers k ON k.keep_id = b.id
LEFT JOIN "products" pr ON pr.id::text = b."sourceId"
WHERE k.keep_id IS NULL
ORDER BY b."createdAt" ASC
`;

/**
 * PR-3 delta: at most one active UPDATE and one active DELETE per idempotencyKey.
 * SUCCEEDED is intentionally excluded so a later edit with changed content stays possible.
 * The insert's ON CONFLICT predicate must match this text exactly.
 */
export const ACTIVE_MUTATION_INDEX_NAME = 'UQ_omnichannel_deliveries_active_mutation';

export const ACTIVE_MUTATION_INDEX_PREDICATE =
  `"action" IN ('UPDATE','DELETE') AND "status" IN ('PENDING','PROCESSING','RETRY','HOLD') AND "supersededAt" IS NULL`;

/** Table that remembers the pre-normalisation key of DELETE rows so down() can restore it. */
export const MUTATION_KEY_UNDO_TABLE = 'omnichannel_delivery_mutation_key_undo';

const MUTATION_ACTIVE_STATUSES = `('PENDING','PROCESSING','RETRY','HOLD')`;

/** DELETE key as built by buildIdempotencyKey: no content hash. */
const NORMALIZED_DELETE_KEY_EXPR =
  `'DELETE:' || d."destinationId"::text || ':' || COALESCE(d."providerMessageId", '') || ':'`;

const MUTATION_DEDUPE_CTES = `
WITH base AS (
  SELECT
    d.id,
    d."eventId",
    d.status,
    d."lastError",
    d."createdAt",
    d.action,
    d."destinationId",
    d."providerMessageId",
    CASE WHEN d.action = 'DELETE' THEN ${NORMALIZED_DELETE_KEY_EXPR} ELSE d."idempotencyKey" END AS "mutationKey"
  FROM "omnichannel_publication_deliveries" d
  WHERE d.action IN ('UPDATE', 'DELETE')
    AND d.status IN ${MUTATION_ACTIVE_STATUSES}
    AND d."supersededAt" IS NULL
),
keepers AS (
  SELECT DISTINCT ON ("mutationKey") id AS keep_id
  FROM base
  ORDER BY
    "mutationKey",
    CASE WHEN status = 'PROCESSING' THEN 0 ELSE 1 END,
    "createdAt" DESC,
    id DESC
)
`;

/** In-flight row wins; otherwise the newest unsent edit wins. Older active rows are losers. */
export const MUTATION_LOSER_ID_SQL = `
${MUTATION_DEDUPE_CTES}
SELECT b.id
FROM base b
LEFT JOIN keepers k ON k.keep_id = b.id
WHERE k.keep_id IS NULL
`;

export const MUTATION_UNDO_INSERT_SQL = `
${MUTATION_DEDUPE_CTES}
INSERT INTO "omnichannel_delivery_dedupe_undo"
  ("deliveryId", "previousStatus", "previousLastError", "outboxId", "previousOutboxStatus")
SELECT
  b.id,
  b.status,
  b."lastError",
  b."eventId",
  e.status
FROM base b
LEFT JOIN keepers k ON k.keep_id = b.id
LEFT JOIN "omnichannel_outbox_events" e ON e.id = b."eventId"
WHERE k.keep_id IS NULL
ON CONFLICT ("deliveryId") DO NOTHING
`;

/** Read-only pre-flight for the owner: which active UPDATE/DELETE rows would be superseded. */
export const MUTATION_DRY_RUN_REPORT_SQL = `
${MUTATION_DEDUPE_CTES}
SELECT
  b.id AS "deliveryId",
  b.action,
  b."destinationId",
  b."providerMessageId",
  b.status AS "previousStatus",
  b."createdAt"
FROM base b
LEFT JOIN keepers k ON k.keep_id = b.id
WHERE k.keep_id IS NULL
ORDER BY b."createdAt" ASC
`;

/** Snapshot active DELETE keys that differ from the no-hash format (runs after losers are gone). */
export const MUTATION_KEY_UNDO_INSERT_SQL = `
INSERT INTO "${MUTATION_KEY_UNDO_TABLE}" ("deliveryId", "previousIdempotencyKey")
SELECT d.id, d."idempotencyKey"
FROM "omnichannel_publication_deliveries" d
WHERE d.action = 'DELETE'
  AND d.status IN ${MUTATION_ACTIVE_STATUSES}
  AND d."supersededAt" IS NULL
  AND COALESCE(d."providerMessageId", '') <> ''
  AND d."idempotencyKey" <> ${NORMALIZED_DELETE_KEY_EXPR}
ON CONFLICT ("deliveryId") DO NOTHING
`;

export const MUTATION_KEY_NORMALIZE_SQL = `
UPDATE "omnichannel_publication_deliveries" d
SET "idempotencyKey" = ${NORMALIZED_DELETE_KEY_EXPR}, "updatedAt" = NOW()
FROM "${MUTATION_KEY_UNDO_TABLE}" u
WHERE d.id = u."deliveryId"
  AND d.action = 'DELETE'
  AND d.status IN ${MUTATION_ACTIVE_STATUSES}
  AND d."supersededAt" IS NULL
  AND d."idempotencyKey" <> ${NORMALIZED_DELETE_KEY_EXPR}
`;

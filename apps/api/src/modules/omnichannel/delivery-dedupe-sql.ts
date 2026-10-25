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

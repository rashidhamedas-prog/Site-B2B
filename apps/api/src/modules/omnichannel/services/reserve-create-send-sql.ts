/**
 * SQL used by reserveCreateSend / HOLD / markCreateSucceeded.
 * Explicit ::casts avoid Postgres 42P08 "inconsistent types deduced for parameter $N"
 * when node-pg binds untyped params across uuid / timestamptz / text / varchar contexts.
 */
export const RESERVE_CREATE_COUNTS_SQL = `SELECT
           (SELECT COUNT(*)::int FROM "omnichannel_publication_deliveries"
             WHERE "destinationId" = $1::uuid AND action = 'CREATE'
               AND status = 'SUCCEEDED' AND "sentAt" >= $2::timestamptz AND id <> $3::uuid) AS sent,
           (SELECT COUNT(*)::int FROM "omnichannel_publication_deliveries"
             WHERE "destinationId" = $1::uuid AND action = 'CREATE' AND "supersededAt" IS NULL
               AND (
                 (status = 'PROCESSING' AND "updatedAt" >= $4::timestamptz)
                 OR status IN ('HOLD', 'PENDING', 'RETRY')
               )
               AND id <> $3::uuid) AS inflight,
           (SELECT MAX("sentAt") FROM "omnichannel_publication_deliveries"
             WHERE "destinationId" = $1::uuid AND action = 'CREATE' AND status = 'SUCCEEDED') AS last_sent,
           (SELECT COUNT(*)::int FROM "omnichannel_publication_deliveries" d
             INNER JOIN "omnichannel_channel_destinations" dest ON dest.id = d."destinationId"
             WHERE dest."connectionId" = $5::uuid AND d.status = 'SUCCEEDED' AND d."sentAt" >= $6::timestamptz) AS per_minute`;

/** $2 bound to both deferredReason and lastError — must be ::text (enum vs text → 42P08). */
export const MARK_CREATE_HOLD_SQL = `UPDATE "omnichannel_publication_deliveries"
           SET status = 'HOLD', "deferredReason" = $2::text, "lastError" = $2::text, "updatedAt" = NOW()
           WHERE id = $1::uuid`;

export const MARK_CREATE_UNCONFIRMED_SQL = `UPDATE "omnichannel_publication_deliveries"
       SET status = 'HOLD', "deferredReason" = $2::text, "lastError" = $2::text, "updatedAt" = NOW()
       WHERE "eventId" = $1::uuid AND action = 'CREATE' AND status <> 'SUCCEEDED' AND "supersededAt" IS NULL`;

export const MARK_CREATE_SUCCEEDED_SQL = `UPDATE "omnichannel_publication_deliveries"
       SET status = 'SUCCEEDED',
           "sentAt" = COALESCE("sentAt", NOW()),
           "providerMessageId" = COALESCE($2::varchar, "providerMessageId"),
           "lastError" = $3::text,
           "deferredReason" = NULL,
           "updatedAt" = NOW()
       WHERE id = $1::uuid
         AND "supersededAt" IS NULL
         AND status IN ('PROCESSING', 'HOLD')
       RETURNING id`;

export const DEFER_CREATE_SQL = `UPDATE "omnichannel_publication_deliveries"
           SET "deferredReason" = $2::text, "nextAttemptAt" = $3::timestamptz, "updatedAt" = NOW()
           WHERE id = $1::uuid AND status <> 'SUCCEEDED'`;

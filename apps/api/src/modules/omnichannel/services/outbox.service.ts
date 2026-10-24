import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import {
  isOmnichannelOutboxProducerEnabled,
  OUTBOX_FORBIDDEN_PAYLOAD_KEYS,
} from '../omnichannel.constants';
import { buildLeaseSql, nextAvailableAt, shouldDeadLetter } from './outbox-lease';

export type OutboxEnqueueInput = {
  operationId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  channel?: string | null;
  payload?: Record<string, unknown>;
  /** Deferred delivery (automation min-gap / quiet hours). Defaults to now. */
  availableAt?: Date;
};

const FORBIDDEN = new Set(OUTBOX_FORBIDDEN_PAYLOAD_KEYS.map((k) => k.toLowerCase()));

export function buildDedupeKey(input: OutboxEnqueueInput): string {
  return [input.operationId, input.eventType, input.aggregateId, input.channel || ''].join(':');
}

/** INSERT … ON CONFLICT DO NOTHING RETURNING id → empty raw means deduped. */
export function outboxInsertedId(raw: unknown): string | null {
  const rows = leaseRowsFromQueryResult(raw);
  return rows.length ? rows[0].id : null;
}

/** TypeORM pg returns [rows, rowCount] for UPDATE…RETURNING — not the rows array. */
export function leaseRowsFromQueryResult(raw: unknown): Array<{ id: string }> {
  const records = Array.isArray(raw) && raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number'
    ? raw[0]
    : raw;
  if (!Array.isArray(records)) return [];
  return records.filter((row): row is { id: string } => {
    return !!row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string';
  });
}

export function sanitizeOutboxPayload(payload?: Record<string, unknown>): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN.has(key.toLowerCase())) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = sanitizeOutboxPayload(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Same write path as lease — do not switch these back to repository.update. */
export const MARK_DONE_SQL = `
UPDATE omnichannel_outbox_events
SET status = 'DONE',
    "completedAt" = NOW(),
    "lastError" = NULL,
    "lockedAt" = NULL,
    "lockedBy" = NULL,
    "updatedAt" = NOW()
WHERE id = $1
`;

export const MARK_FAILURE_SQL = `
UPDATE omnichannel_outbox_events
SET status = $2,
    "lastError" = $3,
    "availableAt" = $4,
    "completedAt" = $5,
    "lockedAt" = NULL,
    "lockedBy" = NULL,
    "updatedAt" = NOW()
WHERE id = $1
`;

/** Soft-cancel waiting work — never DELETE. DONE keeps audit/retention history. */
export const CANCEL_PENDING_SQL = `
UPDATE omnichannel_outbox_events
SET status = 'DONE',
    "completedAt" = NOW(),
    "lastError" = $1,
    "lockedAt" = NULL,
    "lockedBy" = NULL,
    "updatedAt" = NOW()
WHERE status = 'PENDING'
RETURNING id
`;

const CHANNEL_PUBLISH_TYPE_SQL = `(
    "eventType" LIKE 'product.%'
    OR "eventType" LIKE 'blog.%'
    OR "eventType" LIKE 'cms.%'
    OR "eventType" LIKE 'publication.%'
  )`;

/** Soft-cancel only messenger/catalog publish events (not SMS/search/sales_partner). */
export const CANCEL_PENDING_CHANNEL_SQL = `
UPDATE omnichannel_outbox_events
SET status = 'DONE',
    "completedAt" = NOW(),
    "lastError" = $1,
    "lockedAt" = NULL,
    "lockedBy" = NULL,
    "updatedAt" = NOW()
WHERE status = 'PENDING'
  AND ${CHANNEL_PUBLISH_TYPE_SQL}
RETURNING id
`;

/**
 * Same as channel cancel, but skip storefront channels the admin did not register
 * (e.g. hide RETAIL rows when only WHOLESALE bots exist). Null channel = dual-sync, still cleared.
 * $1 = error marker, $2 = text[] of UPPER channel codes.
 */
export const CANCEL_PENDING_CHANNEL_FOR_CHANNELS_SQL = `
UPDATE omnichannel_outbox_events
SET status = 'DONE',
    "completedAt" = NOW(),
    "lastError" = $1,
    "lockedAt" = NULL,
    "lockedBy" = NULL,
    "updatedAt" = NOW()
WHERE status = 'PENDING'
  AND ${CHANNEL_PUBLISH_TYPE_SQL}
  AND ("channel" IS NULL OR UPPER("channel") = ANY($2::text[]))
RETURNING id
`;

/** Only stale PROCESSING locks (worker crash / hung lease). Fresh mid-send stays. */
export const CANCEL_STALE_PROCESSING_SQL = `
UPDATE omnichannel_outbox_events
SET status = 'DONE',
    "completedAt" = NOW(),
    "lastError" = $1,
    "lockedAt" = NULL,
    "lockedBy" = NULL,
    "updatedAt" = NOW()
WHERE status = 'PROCESSING'
  AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - ($2 * INTERVAL '1 minute'))
RETURNING id
`;

export const CANCEL_STALE_PROCESSING_CHANNEL_SQL = `
UPDATE omnichannel_outbox_events
SET status = 'DONE',
    "completedAt" = NOW(),
    "lastError" = $1,
    "lockedAt" = NULL,
    "lockedBy" = NULL,
    "updatedAt" = NOW()
WHERE status = 'PROCESSING'
  AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - ($2 * INTERVAL '1 minute'))
  AND ${CHANNEL_PUBLISH_TYPE_SQL}
RETURNING id
`;

export const CANCEL_STALE_PROCESSING_CHANNEL_FOR_CHANNELS_SQL = `
UPDATE omnichannel_outbox_events
SET status = 'DONE',
    "completedAt" = NOW(),
    "lastError" = $1,
    "lockedAt" = NULL,
    "lockedBy" = NULL,
    "updatedAt" = NOW()
WHERE status = 'PROCESSING'
  AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - ($3 * INTERVAL '1 minute'))
  AND ${CHANNEL_PUBLISH_TYPE_SQL}
  AND ("channel" IS NULL OR UPPER("channel") = ANY($2::text[]))
RETURNING id
`;

@Injectable()
export class OutboxService {
  constructor(
    @InjectRepository(OutboxEventEntity)
    private readonly repo: Repository<OutboxEventEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Idempotent insert. Must never raise inside a caller's transaction: a swallowed
   * 23505 still aborts the Postgres transaction, so the caller's business row
   * (e.g. site_contents) was silently rolled back on COMMIT while the API echoed
   * success. ON CONFLICT DO NOTHING keeps the transaction healthy.
   */
  async enqueue(input: OutboxEnqueueInput, manager?: EntityManager): Promise<{ id: string | null; deduped: boolean }> {
    if (!isOmnichannelOutboxProducerEnabled()) {
      return { id: null, deduped: true };
    }
    const repo = manager?.getRepository(OutboxEventEntity) ?? this.repo;
    const dedupeKey = buildDedupeKey(input);
    const availableAt =
      input.availableAt && input.availableAt.getTime() > Date.now() ? input.availableAt : new Date();
    const result = await repo
      .createQueryBuilder()
      .insert()
      .into(OutboxEventEntity)
      .values({
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        channel: input.channel ?? null,
        payload: sanitizeOutboxPayload(input.payload),
        dedupeKey,
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 8,
        availableAt,
      })
      .orIgnore()
      .returning('id')
      .execute();
    const id = outboxInsertedId(result.raw);
    return { id, deduped: id === null };
  }

  async enqueueMany(inputs: OutboxEnqueueInput[], manager?: EntityManager): Promise<void> {
    for (const input of inputs) {
      await this.enqueue(input, manager);
    }
  }

  async leaseBatch(workerId: string, limit = 20): Promise<OutboxEventEntity[]> {
    const raw = await this.dataSource.query(buildLeaseSql(), [
      Math.max(1, Math.min(limit, 100)),
      workerId.slice(0, 80),
    ]);
    const ids = leaseRowsFromQueryResult(raw).map((r) => r.id);
    if (!ids.length) return [];
    return this.repo.find({ where: { id: In(ids) } });
  }

  async releaseDeferred(id: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE omnichannel_outbox_events
       SET status = 'PENDING', "lockedAt" = NULL, "lockedBy" = NULL, attempts = GREATEST(attempts - 1, 0)
       WHERE id = $1`,
      [id],
    );
  }

  /** Admin retry: put a DEAD/failed event back in the queue with a fresh attempt budget. */
  async requeue(id: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE omnichannel_outbox_events
       SET status = 'PENDING', attempts = 0, "availableAt" = NOW(), "completedAt" = NULL,
           "lockedAt" = NULL, "lockedBy" = NULL, "lastError" = NULL, "updatedAt" = NOW()
       WHERE id = $1 AND status <> 'DONE'`,
      [id],
    );
  }

  /**
   * Soft-revive DEAD publication.deliver rows that only failed because connectors were off.
   * Never DELETE. Returns revived event ids (empty when none match).
   */
  async requeueConnectorDisabledDead(limit = 200): Promise<string[]> {
    const capped = Math.max(1, Math.min(500, Math.floor(Number(limit) || 200)));
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `UPDATE omnichannel_outbox_events
       SET status = 'PENDING', attempts = 0, "availableAt" = NOW(), "completedAt" = NULL,
           "lockedAt" = NULL, "lockedBy" = NULL, "lastError" = NULL, "updatedAt" = NOW()
       WHERE id IN (
         SELECT id FROM omnichannel_outbox_events
         WHERE status = 'DEAD'
           AND "eventType" = 'publication.deliver.requested'
           AND "lastError" ILIKE '%connector is disabled%'
         ORDER BY "updatedAt" ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id`,
      [capped],
    );
    return (rows || []).map((row) => String(row.id));
  }

  /**
   * Admin clear-waiting: PENDING → DONE (cancelled), plus stale PROCESSING only.
   * Never DELETE. Returns cancelled event ids for linked delivery cleanup.
   */
  async cancelWaiting(opts: {
    pendingError: string;
    staleError: string;
    staleLockMinutes?: number;
    /** When 'channel', only soft-cancel messenger/catalog publish event types. */
    scope?: 'all' | 'channel';
    /** When scope=channel and non-empty, skip other storefront channels (align with UI filter). */
    channels?: Array<'RETAIL' | 'WHOLESALE'>;
  }): Promise<{ cancelledPendingIds: string[]; cancelledStaleIds: string[] }> {
    const channelOnly = opts.scope === 'channel';
    const scopedChannels = (opts.channels || [])
      .map((c) => String(c || '').toUpperCase())
      .filter((c): c is 'RETAIL' | 'WHOLESALE' => c === 'RETAIL' || c === 'WHOLESALE');
    const useChannelFilter = channelOnly && scopedChannels.length > 0;
    const err = opts.pendingError.slice(0, 2000);
    const pendingRaw = await this.dataSource.query(
      !channelOnly
        ? CANCEL_PENDING_SQL
        : useChannelFilter
          ? CANCEL_PENDING_CHANNEL_FOR_CHANNELS_SQL
          : CANCEL_PENDING_CHANNEL_SQL,
      useChannelFilter ? [err, scopedChannels] : [err],
    );
    const cancelledPendingIds = leaseRowsFromQueryResult(pendingRaw).map((r) => r.id);
    const minutes = Math.max(1, Math.min(60, Math.floor(opts.staleLockMinutes ?? 5)));
    const staleErr = opts.staleError.slice(0, 2000);
    const staleRaw = await this.dataSource.query(
      !channelOnly
        ? CANCEL_STALE_PROCESSING_SQL
        : useChannelFilter
          ? CANCEL_STALE_PROCESSING_CHANNEL_FOR_CHANNELS_SQL
          : CANCEL_STALE_PROCESSING_CHANNEL_SQL,
      useChannelFilter ? [staleErr, scopedChannels, minutes] : [staleErr, minutes],
    );
    const cancelledStaleIds = leaseRowsFromQueryResult(staleRaw).map((r) => r.id);
    return { cancelledPendingIds, cancelledStaleIds };
  }

  async markDone(id: string): Promise<void> {
    // Raw SQL: TypeORM repo.update left live rows PROCESSING (updatedAt unchanged).
    await this.dataSource.query(MARK_DONE_SQL, [id]);
  }

  async markFailure(row: OutboxEventEntity, error: string): Promise<void> {
    const dead = shouldDeadLetter(row.attempts, row.maxAttempts);
    const availableAt = dead ? row.availableAt : nextAvailableAt(row.attempts, new Date(), Math.random());
    await this.dataSource.query(MARK_FAILURE_SQL, [
      row.id,
      dead ? 'DEAD' : 'PENDING',
      error.slice(0, 2000),
      availableAt,
      dead ? new Date() : null,
    ]);
  }
}


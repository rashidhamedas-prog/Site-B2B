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
};

const FORBIDDEN = new Set(OUTBOX_FORBIDDEN_PAYLOAD_KEYS.map((k) => k.toLowerCase()));

export function buildDedupeKey(input: OutboxEnqueueInput): string {
  return [input.operationId, input.eventType, input.aggregateId, input.channel || ''].join(':');
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

@Injectable()
export class OutboxService {
  constructor(
    @InjectRepository(OutboxEventEntity)
    private readonly repo: Repository<OutboxEventEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async enqueue(input: OutboxEnqueueInput, manager?: EntityManager): Promise<{ id: string | null; deduped: boolean }> {
    if (!isOmnichannelOutboxProducerEnabled()) {
      return { id: null, deduped: true };
    }
    const repo = manager?.getRepository(OutboxEventEntity) ?? this.repo;
    const dedupeKey = buildDedupeKey(input);
    const row = repo.create({
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      channel: input.channel ?? null,
      payload: sanitizeOutboxPayload(input.payload),
      dedupeKey,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 8,
      availableAt: new Date(),
    });
    try {
      const saved = await repo.save(row);
      return { id: saved.id, deduped: false };
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : '';
      if (code === '23505') {
        return { id: null, deduped: true };
      }
      throw err;
    }
  }

  async enqueueMany(inputs: OutboxEnqueueInput[], manager?: EntityManager): Promise<void> {
    for (const input of inputs) {
      await this.enqueue(input, manager);
    }
  }

  async leaseBatch(workerId: string, limit = 20): Promise<OutboxEventEntity[]> {
    const rows: Array<{ id: string }> = await this.dataSource.query(buildLeaseSql(), [
      Math.max(1, Math.min(limit, 100)),
      workerId.slice(0, 80),
    ]);
    const ids = (rows ?? []).map((r) => r.id).filter(Boolean);
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


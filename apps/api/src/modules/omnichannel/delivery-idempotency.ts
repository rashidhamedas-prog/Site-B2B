import { createHash } from 'crypto';
import { DEFAULT_AUTO_DAILY_CAP } from './omnichannel.constants';
import { tehranDayStart } from '../../lib/tehran-time';

export const MIN_SEND_GAP_FLOOR_SECONDS = 60;
export const DEFAULT_STALE_DELIVERY_HOURS = 24;
export const DEFAULT_MAX_SENDS_PER_MINUTE = 2;
export const PROCESSING_RESERVATION_MS = 10 * 60_000;

const ACTIVE_MERGE = new Set(['PENDING', 'PROCESSING', 'RETRY']);
/** HOLD always needs human reapprove (stale or send_unconfirmed). Never auto-reuse. */
const REUSABLE = new Set(['DEAD', 'FAILED']);

export type DeliveryActionName = 'CREATE' | 'UPDATE' | 'DELETE';

export function contentHash(parts: {
  text?: string | null;
  photoUrls?: unknown;
  buttons?: unknown;
}): string {
  const photoUrls = Array.isArray(parts.photoUrls) ? parts.photoUrls : [];
  const buttons = Array.isArray(parts.buttons) ? parts.buttons : [];
  return createHash('sha256')
    .update(JSON.stringify({
      text: String(parts.text || ''),
      photoUrls,
      buttons,
    }))
    .digest('hex');
}

export function buildIdempotencyKey(input: {
  action: DeliveryActionName;
  sourceType: string;
  sourceId: string;
  destinationId: string;
  providerMessageId?: string | null;
  contentHash?: string | null;
}): string {
  if (input.action === 'CREATE') {
    return `CREATE:${input.sourceType}:${input.sourceId}:${input.destinationId}`;
  }
  return `${input.action}:${input.destinationId}:${input.providerMessageId || ''}:${input.contentHash || ''}`;
}

export type ExistingCreateRow = {
  id: string;
  status: string;
  contentHash: string | null;
  providerMessageId: string | null;
  eventId: string;
  publicationId: string;
  createdAt: Date;
  deferredReason?: string | null;
};

export type CreateEnqueueDecision =
  | { kind: 'insert' }
  | { kind: 'skip'; reason: 'create_deduped' | 'hold_needs_reapproval' }
  | { kind: 'convert_update'; providerMessageId: string; publicationId: string }
  | { kind: 'merge'; deliveryId: string; eventId: string; supersedeIds: string[] }
  | { kind: 'reuse'; deliveryId: string; eventId: string; supersedeIds: string[] };

function newest(rows: ExistingCreateRow[]): ExistingCreateRow {
  return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

function oldest(rows: ExistingCreateRow[]): ExistingCreateRow {
  return [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
}

/** One live CREATE slot per product per destination. Latest payload wins on an in-flight row. */
export function decideCreateEnqueue(rows: ExistingCreateRow[], nextHash: string): CreateEnqueueDecision {
  const succeeded = rows.filter((row) => row.status === 'SUCCEEDED');
  if (succeeded.length) {
    const winner = oldest(succeeded);
    if (winner.contentHash && winner.contentHash === nextHash) {
      return { kind: 'skip', reason: 'create_deduped' };
    }
    if (winner.providerMessageId) {
      return {
        kind: 'convert_update',
        providerMessageId: winner.providerMessageId,
        publicationId: winner.publicationId,
      };
    }
    return { kind: 'skip', reason: 'create_deduped' };
  }
  const held = rows.filter((row) => row.status === 'HOLD');
  if (held.length) return { kind: 'skip', reason: 'hold_needs_reapproval' };
  const active = rows.filter((row) => ACTIVE_MERGE.has(row.status));
  if (active.length) {
    const winner = newest(active);
    return {
      kind: 'merge',
      deliveryId: winner.id,
      eventId: winner.eventId,
      supersedeIds: active.filter((row) => row.id !== winner.id).map((row) => row.id),
    };
  }
  const reusable = rows.filter((row) => REUSABLE.has(row.status));
  if (reusable.length) {
    const winner = newest(reusable);
    return {
      kind: 'reuse',
      deliveryId: winner.id,
      eventId: winner.eventId,
      supersedeIds: reusable.filter((row) => row.id !== winner.id).map((row) => row.id),
    };
  }
  return { kind: 'insert' };
}

export function decideRetryAgainstSibling(input: {
  deliveryId: string;
  hasLiveSucceededSibling: boolean;
}): 'retry' | 'supersede' {
  return input.hasLiveSucceededSibling ? 'supersede' : 'retry';
}

export function decideSendWinner(
  self: { id: string; createdAt: Date },
  others: Array<{ id: string; createdAt: Date; status: string }>,
): 'send' | 'supersede' {
  if (others.some((row) => row.id !== self.id && row.status === 'SUCCEEDED')) return 'supersede';
  const newer = others.some((row) =>
    row.id !== self.id
    && ['PENDING', 'PROCESSING', 'RETRY', 'HOLD'].includes(row.status)
    && row.createdAt.getTime() > self.createdAt.getTime(),
  );
  return newer ? 'supersede' : 'send';
}

export function staleDeliveryHours(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.OMNICHANNEL_STALE_DELIVERY_HOURS);
  if (Number.isFinite(n) && n > 0) return n;
  return DEFAULT_STALE_DELIVERY_HOURS;
}

export function maxSendsPerMinute(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.OMNICHANNEL_MAX_SENDS_PER_MINUTE);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return DEFAULT_MAX_SENDS_PER_MINUTE;
}

export function effectiveMinGapSeconds(configured: number): number {
  const n = Math.floor(Number(configured) || 0);
  return Math.max(MIN_SEND_GAP_FLOOR_SECONDS, n);
}

/** Destination setting wins unless a provider env override is set. */
export function dailyCapForProvider(provider: string, configured: number, env: NodeJS.ProcessEnv = process.env): number {
  const fromEnv = Number(env[`OMNICHANNEL_DAILY_CAP_${String(provider || '').toUpperCase()}`]);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  const n = Math.floor(Number(configured) || 0);
  return n > 0 ? n : DEFAULT_AUTO_DAILY_CAP;
}

export function isStaleDelivery(createdAt: Date, reapprovedAt: Date | null, now: Date, hours: number): boolean {
  const basis = reapprovedAt && reapprovedAt.getTime() > createdAt.getTime() ? reapprovedAt : createdAt;
  return now.getTime() - basis.getTime() > hours * 3_600_000;
}

export function capJitterMs(destinationId: string, dayStart: Date): number {
  const s = `${destinationId}:${dayStart.toISOString()}`;
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) hash = (hash * 33 + s.charCodeAt(i)) >>> 0;
  return hash % 30_000;
}

export function decideDailyCap(input: {
  sentToday: number;
  inFlight: number;
  cap: number;
  now: Date;
  quietEndHour: number | null;
  jitterMs: number;
}): { allow: boolean; availableAt?: Date } {
  const used = Math.max(0, Math.floor(input.sentToday)) + Math.max(0, Math.floor(input.inFlight));
  const cap = Math.max(0, Math.floor(input.cap));
  if (used < cap) return { allow: true };
  const nextMidnight = new Date(tehranDayStart(input.now).getTime() + 24 * 60 * 60_000);
  const quietHours = input.quietEndHour == null ? 0 : Math.max(0, Math.min(23, Math.floor(input.quietEndHour)));
  return {
    allow: false,
    availableAt: new Date(nextMidnight.getTime() + quietHours * 3_600_000 + Math.max(0, input.jitterMs)),
  };
}

export function decideMinGap(
  now: Date,
  lastSentAt: Date | null,
  minGapSeconds: number,
): { allow: boolean; availableAt?: Date } {
  if (!lastSentAt || minGapSeconds <= 0) return { allow: true };
  const availableAt = new Date(lastSentAt.getTime() + minGapSeconds * 1000);
  if (availableAt.getTime() <= now.getTime()) return { allow: true };
  return { allow: false, availableAt };
}

export function decideRateLimit(
  now: Date,
  sendsLastMinute: number,
  maxPerMinute: number,
): { allow: boolean; availableAt?: Date } {
  if (sendsLastMinute < maxPerMinute) return { allow: true };
  return { allow: false, availableAt: new Date(now.getTime() + 60_000) };
}

export type SendPlan =
  | { kind: 'send' }
  | { kind: 'supersede' }
  | { kind: 'hold'; reason: 'stale_needs_reapproval' }
  | { kind: 'defer'; reason: 'daily_cap' | 'min_gap' | 'rate_limit'; availableAt: Date };

export function planCreateSend(input: {
  now: Date;
  createdAt: Date;
  reapprovedAt: Date | null;
  staleHours: number;
  sentToday: number;
  inFlight: number;
  cap: number;
  lastSentAt: Date | null;
  minGapSeconds: number;
  sendsLastMinute: number;
  maxPerMinute: number;
  quietEndHour: number | null;
  jitterMs: number;
  winner: 'send' | 'supersede';
}): SendPlan {
  if (input.winner === 'supersede') return { kind: 'supersede' };
  if (isStaleDelivery(input.createdAt, input.reapprovedAt, input.now, input.staleHours)) {
    return { kind: 'hold', reason: 'stale_needs_reapproval' };
  }
  const cap = decideDailyCap({
    sentToday: input.sentToday,
    inFlight: input.inFlight,
    cap: input.cap,
    now: input.now,
    quietEndHour: input.quietEndHour,
    jitterMs: input.jitterMs,
  });
  if (!cap.allow) return { kind: 'defer', reason: 'daily_cap', availableAt: deferredUntil(cap) };
  const gap = decideMinGap(input.now, input.lastSentAt, input.minGapSeconds);
  if (!gap.allow) return { kind: 'defer', reason: 'min_gap', availableAt: deferredUntil(gap) };
  const rate = decideRateLimit(input.now, input.sendsLastMinute, input.maxPerMinute);
  if (!rate.allow) return { kind: 'defer', reason: 'rate_limit', availableAt: deferredUntil(rate) };
  return { kind: 'send' };
}

function deferredUntil(result: { allow: boolean; availableAt?: Date }): Date {
  return result.availableAt || new Date();
}

export function publicationToReuse<T extends { updatedAt: Date; createdAt: Date }>(rows: T[]): T | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    const byUpdate = b.updatedAt.getTime() - a.updatedAt.getTime();
    return byUpdate !== 0 ? byUpdate : b.createdAt.getTime() - a.createdAt.getTime();
  })[0];
}

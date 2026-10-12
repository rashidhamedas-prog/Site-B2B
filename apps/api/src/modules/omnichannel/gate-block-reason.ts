/**
 * Operator-facing reason why auto-publish is not producing posts today.
 * Conservative: first matching blocker wins (mode → flags → destinations → cap → quiet).
 */

export type GateBlockReason =
  | 'mode_off'
  | 'flags_off'
  | 'no_canary'
  | 'no_destination'
  | 'daily_cap'
  | 'quiet'
  | 'none';

export type GateBlockInput = {
  mode: 'OFF' | 'CANARY' | 'LIVE';
  connectorsEnabled: boolean;
  autoPublishFlag: boolean;
  hasCanary: boolean;
  hasReadyDestination: boolean;
  /** Distinct auto CREATE count today (Tehran) across channels; compare to dailyCap. */
  sentToday: number;
  dailyCap: number;
  quietStartHour: number | null;
  quietEndHour: number | null;
  /** Current Tehran hour 0..23 */
  tehranHourNow: number;
};

export function inQuietHoursSimple(
  hour: number,
  start: number | null,
  end: number | null,
): boolean {
  if (start == null || end == null || start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function resolveGateBlockReason(input: GateBlockInput): GateBlockReason {
  if (input.mode === 'OFF') return 'mode_off';
  if (!input.connectorsEnabled || !input.autoPublishFlag) return 'flags_off';
  if (input.mode === 'CANARY' && !input.hasCanary) return 'no_canary';
  if (input.mode === 'LIVE' && !input.hasReadyDestination) return 'no_destination';
  if (input.mode === 'CANARY' && !input.hasReadyDestination && !input.hasCanary) return 'no_destination';
  if (input.sentToday >= input.dailyCap) return 'daily_cap';
  if (inQuietHoursSimple(input.tehranHourNow, input.quietStartHour, input.quietEndHour)) {
    return 'quiet';
  }
  return 'none';
}

/** Outbox event types that belong to messenger publishing (not SMS/search/marketing). */
export const CHANNEL_PUBLISH_EVENT_PREFIXES = [
  'product.',
  'blog.',
  'cms.',
  'publication.',
] as const;

export function isChannelPublishEventType(eventType: string): boolean {
  const t = String(eventType || '');
  return CHANNEL_PUBLISH_EVENT_PREFIXES.some((prefix) => t.startsWith(prefix));
}

export type DeadByEventType = { eventType: string; count: number };

/** Aggregate DEAD rows by eventType, sorted desc; optionally filter to channel-publish only. */
export function summarizeDeadByEventType(
  rows: Array<{ eventType?: string | null; status?: string | null }>,
  opts?: { channelOnly?: boolean; limit?: number },
): DeadByEventType[] {
  const limit = opts?.limit ?? 12;
  const map = new Map<string, number>();
  for (const row of rows) {
    if (String(row.status || '').toUpperCase() !== 'DEAD') continue;
    const eventType = String(row.eventType || 'unknown');
    if (opts?.channelOnly && !isChannelPublishEventType(eventType)) continue;
    map.set(eventType, (map.get(eventType) || 0) + 1);
  }
  return [...map.entries()]
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((a, b) => b.count - a.count || a.eventType.localeCompare(b.eventType))
    .slice(0, limit);
}

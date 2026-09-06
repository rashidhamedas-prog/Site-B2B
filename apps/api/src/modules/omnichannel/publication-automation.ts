/**
 * Channel automation decisions. Pure functions; the service supplies counts and rows.
 * Nothing here talks to Telegram or the database.
 */
import { TEHRAN_UTC_OFFSET_MINUTES, type AutoPublishMode, type WithdrawAction } from './omnichannel.constants';
import { destinationCanPost, isCanarySettings, type OosPolicy } from './oos-policy';

/** Stock changes never create posts by themselves; they only edit/delete/restore via OOS policy. */
export const STOCK_EVENT = 'product.stock_changed';

export type AutomationGateInput = {
  mode: AutoPublishMode;
  eventType: string;
  chosenEvents: readonly string[];
  connectorsEnabled: boolean;
  autoPublishFlag: boolean;
  /** Distinct auto posts already scheduled today (Tehran day) for this sales channel. */
  sentToday: number;
  dailyCap: number;
  /** availableAt of the latest auto CREATE for this channel, if any. */
  lastScheduledAt: Date | null;
  minGapSeconds: number;
  quietStartHour: number | null;
  quietEndHour: number | null;
  now: Date;
  /**
   * True when the caller already resolved a CREATE intent (restock/reopen paths may create on a
   * stock event); false keeps the strict "event must be chosen" rule.
   */
  createTrigger?: boolean;
};

export type AutomationGate =
  | { allow: true; sendAt: Date; deferred: boolean }
  | { allow: false; reason: 'mode_off' | 'flags_off' | 'event_not_chosen' | 'daily_cap' };

export function tehranHour(now: Date, offsetMinutes = TEHRAN_UTC_OFFSET_MINUTES): number {
  const shifted = new Date(now.getTime() + offsetMinutes * 60_000);
  return shifted.getUTCHours();
}

export function tehranDayStart(now: Date, offsetMinutes = TEHRAN_UTC_OFFSET_MINUTES): Date {
  const shifted = new Date(now.getTime() + offsetMinutes * 60_000);
  const startShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(startShifted - offsetMinutes * 60_000);
}

/** Window may wrap midnight (e.g. 23 → 8). start === end means no window. */
export function inQuietHours(hour: number, start: number | null, end: number | null): boolean {
  if (start == null || end == null || start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function nextQuietEnd(now: Date, endHour: number, offsetMinutes = TEHRAN_UTC_OFFSET_MINUTES): Date {
  const shifted = new Date(now.getTime() + offsetMinutes * 60_000);
  let end = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), endHour, 0, 0);
  if (end <= shifted.getTime()) end += 24 * 60 * 60_000;
  return new Date(end - offsetMinutes * 60_000);
}

export function evaluateAutomationGate(input: AutomationGateInput): AutomationGate {
  if (input.mode === 'OFF') return { allow: false, reason: 'mode_off' };
  if (!input.connectorsEnabled || !input.autoPublishFlag) return { allow: false, reason: 'flags_off' };
  if (!input.createTrigger && !input.chosenEvents.includes(input.eventType)) {
    return { allow: false, reason: 'event_not_chosen' };
  }
  if (input.sentToday >= input.dailyCap) return { allow: false, reason: 'daily_cap' };
  let sendAt = input.now;
  if (input.lastScheduledAt && input.minGapSeconds > 0) {
    const gapEnd = new Date(input.lastScheduledAt.getTime() + input.minGapSeconds * 1000);
    if (gapEnd > sendAt) sendAt = gapEnd;
  }
  if (input.quietEndHour != null && inQuietHours(tehranHour(sendAt), input.quietStartHour, input.quietEndHour)) {
    sendAt = nextQuietEnd(sendAt, input.quietEndHour);
  }
  return { allow: true, sendAt, deferred: sendAt.getTime() > input.now.getTime() };
}

/**
 * CANARY → the canary destination only. LIVE → canary plus every enabled destination whose
 * server-side verification says the bot can post. Unverified channels never receive automation.
 */
export function selectAutomationDestinations<
  D extends { id: string; connectionId: string; enabled: boolean; settings?: Record<string, unknown> | null },
  C extends { id: string; provider: string; channel: string; status: string },
>(dests: D[], conns: C[], channel: string, mode: AutoPublishMode): D[] {
  if (mode === 'OFF') return [];
  const byId = new Map(conns.map((row) => [row.id, row]));
  return dests.filter((dest) => {
    if (!dest.enabled) return false;
    const conn = byId.get(dest.connectionId);
    if (!conn || conn.provider !== 'TELEGRAM' || conn.channel !== channel || conn.status !== 'ACTIVE') return false;
    if (isCanarySettings(dest.settings)) return true;
    return mode === 'LIVE' && destinationCanPost(dest.settings);
  });
}

export type RemoteIntent =
  | { action: 'CREATE' }
  | { action: 'UPDATE'; notice: boolean }
  | { action: 'DELETE' }
  | { action: 'none'; reason: string };

export type RemoteIntentInput = {
  eventType: string;
  /** Local publication mutation just applied: create | update | refresh | reopen | withdraw | skip. */
  localAction: string;
  /** Publication status before this sync; WITHDRAWN means the remote side was already handled. */
  previousStatus: string | null;
  publishable: boolean;
  available: boolean;
  hasRemoteMessage: boolean;
  oosPolicy: OosPolicy;
  oosChosen: boolean;
  withdrawAction: WithdrawAction;
  chosenEvents: readonly string[];
};

/**
 * What the channel post should do after a catalog change.
 * - Product hidden/deleted: delete the live post (or keep it), never create.
 * - Out of stock: only the chosen OOS policy may touch the live post; nothing is created.
 * - Stock event while in stock: restore a HIDE notice on reopen; recreate only after an OOS DELETE.
 * - Chosen catalog events: create when absent, edit when present.
 */
export function resolveRemoteIntent(input: RemoteIntentInput): RemoteIntent {
  const alreadyWithdrawn = input.previousStatus === 'WITHDRAWN';
  if (!input.publishable) {
    if (!input.hasRemoteMessage) return { action: 'none', reason: 'not_publishable' };
    if (alreadyWithdrawn) return { action: 'none', reason: 'already_withdrawn' };
    return input.withdrawAction === 'KEEP' ? { action: 'none', reason: 'withdraw_keep' } : { action: 'DELETE' };
  }
  if (!input.available) {
    if (!input.oosChosen) return { action: 'none', reason: 'oos_unchosen' };
    if (!input.hasRemoteMessage) return { action: 'none', reason: 'oos_skip_create' };
    if (alreadyWithdrawn && input.oosPolicy !== 'UPDATE') return { action: 'none', reason: 'already_withdrawn' };
    if (input.oosPolicy === 'DELETE') return { action: 'DELETE' };
    if (input.oosPolicy === 'HIDE') return { action: 'UPDATE', notice: true };
    // UPDATE policy keeps the post; content/price edits still flow through when that event is chosen.
    return input.eventType !== STOCK_EVENT && input.chosenEvents.includes(input.eventType)
      ? { action: 'UPDATE', notice: false }
      : { action: 'none', reason: 'oos_update_keep' };
  }
  if (input.eventType === STOCK_EVENT) {
    if (input.localAction !== 'reopen') return { action: 'none', reason: 'stock_only' };
    if (input.hasRemoteMessage) return { action: 'UPDATE', notice: false };
    return input.oosChosen && input.oosPolicy === 'DELETE'
      ? { action: 'CREATE' }
      : { action: 'none', reason: 'stock_only' };
  }
  if (!input.chosenEvents.includes(input.eventType)) {
    return input.localAction === 'reopen' && input.hasRemoteMessage
      ? { action: 'UPDATE', notice: false }
      : { action: 'none', reason: 'event_not_chosen' };
  }
  return input.hasRemoteMessage ? { action: 'UPDATE', notice: false } : { action: 'CREATE' };
}

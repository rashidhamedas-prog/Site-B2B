/**
 * Channel automation decisions. Pure functions; the service supplies counts and rows.
 * Nothing here talks to Telegram or the database.
 */
import {
  isOmnichannelProvider,
  type AutoPublishMode,
  type WithdrawAction,
} from './omnichannel.constants';
import { destinationCanPost, isCanarySettings, type OosPolicy } from './oos-policy';
export {
  tehranHour,
  tehranDayStart,
  inQuietHours,
  nextQuietEnd,
} from '../../lib/tehran-time';
import { inQuietHours, nextQuietEnd, tehranHour } from '../../lib/tehran-time';

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
 * CANARY → the canary destinations only. LIVE → canaries plus every enabled destination whose
 * server-side verification (getChatMember, or a successful test post on Rubika) says the bot can
 * post. Every official provider qualifies; unverified channels never receive automation.
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
    if (!conn || !isOmnichannelProvider(conn.provider) || conn.channel !== channel || conn.status !== 'ACTIVE') return false;
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

/* ---------- live remote trail + manual publish plan ---------- */

export type DeliveryTrailRow = {
  publicationId: string;
  destinationId: string;
  action: string;
  status: string;
  providerMessageId?: string | null;
};

export type LiveRemoteMessage = {
  publicationId: string;
  destinationId: string;
  providerMessageId: string;
};

/**
 * Fold delivery history into at most one live remote message per destination.
 * Key is destinationId only (not publicationId): republishing the same product must
 * UPDATE the existing messenger post, not CREATE a second one.
 */
export function foldLiveRemoteMessages(rows: DeliveryTrailRow[]): LiveRemoteMessage[] {
  const live = new Map<string, LiveRemoteMessage>();
  for (const row of rows) {
    const key = row.destinationId;
    if (row.action === 'CREATE' && row.status === 'SUCCEEDED' && row.providerMessageId) {
      live.set(key, {
        publicationId: row.publicationId,
        destinationId: row.destinationId,
        providerMessageId: row.providerMessageId,
      });
    } else if (row.action === 'DELETE' && ['SUCCEEDED', 'PENDING', 'PROCESSING', 'RETRY'].includes(row.status)) {
      live.delete(key);
    }
  }
  return [...live.values()];
}

export type ManualDeliveryPlan = {
  creates: Array<{ destinationId: string }>;
  updates: Array<{ destinationId: string; providerMessageId: string; publicationId: string }>;
};

/** Split manual targets into CREATE (no live post) vs UPDATE (edit existing messenger message). */
export function planManualDeliveries(
  targetIds: string[],
  live: LiveRemoteMessage[],
  pendingCreates: ReadonlySet<string> = new Set(),
): ManualDeliveryPlan {
  const byDest = new Map(live.map((msg) => [msg.destinationId, msg]));
  const creates: ManualDeliveryPlan['creates'] = [];
  const updates: ManualDeliveryPlan['updates'] = [];
  for (const id of targetIds) {
    if (pendingCreates.has(id)) continue;
    const existing = byDest.get(id);
    if (existing) {
      updates.push({
        destinationId: id,
        providerMessageId: existing.providerMessageId,
        publicationId: existing.publicationId,
      });
    } else {
      creates.push({ destinationId: id });
    }
  }
  return { creates, updates };
}

/**
 * Manual admin send needs CONNECTORS only. OMNICHANNEL_AUTO_PUBLISH gates catalog automation,
 * not the «ارسال» / «ارسال آزمایشی» buttons.
 */
export function canEnqueueManualDelivery(connectorsEnabled: boolean): boolean {
  return connectorsEnabled === true;
}

/* ---------- category allowlist (auto publish only) ---------- */

export type CategoryAllowlistGateInput = {
  /** Empty / absent allowlist = open (backward compatible with LIVE). */
  allowlist: readonly string[];
  primaryCategoryId: string | null;
  membershipCategoryIds: readonly string[];
};

export type CategoryAllowlistGate =
  | { allow: true }
  | { allow: false; reason: 'category_not_allowed' };

/** Dedupe primary + memberships; drop null/blank. */
export function collectProductCategoryIds(
  primaryCategoryId: string | null | undefined,
  membershipCategoryIds: readonly (string | null | undefined)[] = [],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [primaryCategoryId, ...membershipCategoryIds]) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Channel eligibility gate: non-empty allowlist requires the product to share at least one
 * category (primary or membership). Empty allowlist does not filter.
 */
export function evaluateCategoryAllowlistGate(input: CategoryAllowlistGateInput): CategoryAllowlistGate {
  if (!input.allowlist.length) return { allow: true };
  const allowed = new Set(input.allowlist);
  const productIds = collectProductCategoryIds(input.primaryCategoryId, input.membershipCategoryIds);
  if (productIds.some((id) => allowed.has(id))) return { allow: true };
  return { allow: false, reason: 'category_not_allowed' };
}

/** Keep the newest row per source×channel (input must already be newest-first). */
export function latestPublicationsBySource<T extends {
  sourceType?: string;
  sourceId: string;
  channel: string;
}>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = `${row.sourceType || 'PRODUCT'}:${row.sourceId}:${row.channel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

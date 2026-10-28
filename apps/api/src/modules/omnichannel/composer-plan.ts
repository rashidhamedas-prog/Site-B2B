/**
 * PR-9 Composer dry-run plan (pure).
 * No adapters, fetch, or DB — caller supplies liveRemote + pending + cap/quiet inputs.
 */
import { formatTehranTimestamp } from './coverage-matrix';
import { inQuietHours, nextQuietEnd, tehranHour } from '../../lib/tehran-time';

export type ComposerSendMode = 'now' | 'next_slot' | 'scheduled';

export type ComposerPlanAction = 'CREATE' | 'UPDATE' | 'SKIP';

/** Same shape as publication-automation LiveRemoteMessage — kept local to avoid Nest import graph. */
export type ComposerLiveRemote = {
  publicationId: string;
  destinationId: string;
  providerMessageId: string;
};

export type ComposerDestinationMeta = {
  destinationId: string;
  channel: string;
  provider: string;
  /** Optional pre-rendered preview text (scrubbed by caller). */
  renderedPreview?: string;
  quietStartHour?: number | null;
  quietEndHour?: number | null;
  sentToday?: number;
  dailyCap?: number;
  lastScheduledAt?: Date | null;
  minGapSeconds?: number;
};

function remainingDailyCreates(sentToday: number, dailyCap: number): number {
  const used = Math.max(0, Math.floor(Number(sentToday) || 0));
  const cap = Math.max(0, Math.floor(Number(dailyCap) || 0));
  return Math.max(0, cap - used);
}

export type ComposerDestinationPlan = {
  destinationId: string;
  channel: string;
  provider: string;
  action: ComposerPlanAction;
  liveHint?: { providerMessageId: string; publicationId: string };
  renderedPreview: string;
  capRemaining: number;
  quietConflict: boolean;
  slotAtTehran: string | null;
  skipReason?: string;
};

export type ComposerPlanSummary = {
  createCount: number;
  updateCount: number;
  skipCount: number;
  quietConflictCount: number;
};

export type BuildComposerPlanInput = {
  destinations: ComposerDestinationMeta[];
  liveRemote: ComposerLiveRemote[];
  pendingCreates: ReadonlySet<string>;
  sendMode: ComposerSendMode;
  scheduledAt?: Date | null;
  now?: Date;
};

export type ComposerPlanResult = {
  destinations: ComposerDestinationPlan[];
  summary: ComposerPlanSummary;
};

const QUIET_NOW_MESSAGE =
  'الان در ساعت سکوت هستید؛ «اکنون» مجاز نیست. «slot بعدی» را انتخاب کنید یا زمان خارج از پنجره سکوت بگذارید.';

export function composerQuietNowMessage(): string {
  return QUIET_NOW_MESSAGE;
}

function resolveSlot(input: {
  sendMode: ComposerSendMode;
  scheduledAt?: Date | null;
  now: Date;
  quietStartHour: number | null;
  quietEndHour: number | null;
  lastScheduledAt: Date | null;
  minGapSeconds: number;
}): { slotAt: Date; quietConflict: boolean } {
  const { sendMode, now, quietStartHour, quietEndHour, lastScheduledAt, minGapSeconds } = input;

  if (sendMode === 'now') {
    const conflict = inQuietHours(tehranHour(now), quietStartHour, quietEndHour);
    return { slotAt: now, quietConflict: conflict };
  }

  if (sendMode === 'scheduled') {
    const at = input.scheduledAt && Number.isFinite(input.scheduledAt.getTime())
      ? input.scheduledAt
      : now;
    const conflict = inQuietHours(tehranHour(at), quietStartHour, quietEndHour);
    return { slotAt: at, quietConflict: conflict };
  }

  // next_slot — same shift idea as evaluateAutomationGate (gap then quiet end).
  let sendAt = now;
  if (lastScheduledAt && minGapSeconds > 0) {
    const gapEnd = new Date(lastScheduledAt.getTime() + minGapSeconds * 1000);
    if (gapEnd > sendAt) sendAt = gapEnd;
  }
  if (quietEndHour != null && inQuietHours(tehranHour(sendAt), quietStartHour, quietEndHour)) {
    sendAt = nextQuietEnd(sendAt, quietEndHour);
  }
  return { slotAt: sendAt, quietConflict: false };
}

/**
 * Per-destination CREATE / UPDATE / SKIP + quiet/cap hints.
 * Pending CREATE without a live post → SKIP (operator should wait; live path still merges).
 */
export function buildComposerPlan(input: BuildComposerPlanInput): ComposerPlanResult {
  const now = input.now || new Date();
  const byLive = new Map(input.liveRemote.map((msg) => [msg.destinationId, msg]));
  const destinations: ComposerDestinationPlan[] = [];

  for (const dest of input.destinations) {
    const live = byLive.get(dest.destinationId);
    const sentToday = Math.max(0, Number(dest.sentToday) || 0);
    const dailyCap = Math.max(0, Number(dest.dailyCap) || 0);
    const capRemaining = remainingDailyCreates(sentToday, dailyCap);
    const slot = resolveSlot({
      sendMode: input.sendMode,
      scheduledAt: input.scheduledAt,
      now,
      quietStartHour: dest.quietStartHour ?? null,
      quietEndHour: dest.quietEndHour ?? null,
      lastScheduledAt: dest.lastScheduledAt ?? null,
      minGapSeconds: Math.max(0, Number(dest.minGapSeconds) || 0),
    });

    let action: ComposerPlanAction = 'CREATE';
    let skipReason: string | undefined;
    let liveHint: ComposerDestinationPlan['liveHint'];

    if (input.pendingCreates.has(dest.destinationId) && !live) {
      action = 'SKIP';
      skipReason = 'pending_create';
    } else if (live) {
      action = 'UPDATE';
      liveHint = {
        providerMessageId: live.providerMessageId,
        publicationId: live.publicationId,
      };
    } else {
      action = 'CREATE';
    }

    destinations.push({
      destinationId: dest.destinationId,
      channel: dest.channel,
      provider: dest.provider,
      action,
      liveHint,
      renderedPreview: String(dest.renderedPreview || '').slice(0, 4096),
      capRemaining,
      quietConflict: slot.quietConflict,
      slotAtTehran: formatTehranTimestamp(slot.slotAt),
      skipReason,
    });
  }

  const summary: ComposerPlanSummary = {
    createCount: destinations.filter((d) => d.action === 'CREATE').length,
    updateCount: destinations.filter((d) => d.action === 'UPDATE').length,
    skipCount: destinations.filter((d) => d.action === 'SKIP').length,
    quietConflictCount: destinations.filter((d) => d.quietConflict).length,
  };

  return { destinations, summary };
}

/** Live «اکنون» with quiet conflict → Persian 400 (composer validate before confirm). */
export function assertComposerSendAllowed(plan: ComposerPlanResult, sendMode: ComposerSendMode): void {
  if (sendMode !== 'now' && sendMode !== 'scheduled') return;
  if (plan.summary.quietConflictCount > 0) {
    const err = new Error(QUIET_NOW_MESSAGE);
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
}

/**
 * PR-13 — pure unanswered-bot-message evaluation (REQ-O4 slice).
 * No I/O, no chat-id invention, no Telegram egress.
 */

export const DEFAULT_UNANSWERED_THRESHOLD_SEC = 60;
export const BODY_PREVIEW_MAX = 200;
export const OWNER_NOTIFY_ATTEMPT_CAP = 3;

export type UnansweredConversationRow = {
  conversationId: string;
  destinationId: string;
  provider: string;
  status: 'open' | 'closed' | string;
  lastCustomerMessageAt: Date | string | null;
  lastStaffReplyAt: Date | string | null;
};

export type OpenAlertKey = {
  conversationId: string;
  status: 'open' | 'acked' | 'resolved' | string;
};

export type UnansweredEvalDecision =
  | { action: 'raise'; conversationId: string; destinationId: string; ageSec: number }
  | { action: 'skip'; conversationId: string; reason: 'closed' | 'no_customer_msg' | 'answered' | 'within_threshold' | 'open_alert_exists' };

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function unansweredThresholdSec(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.OMNICHANNEL_UNANSWERED_THRESHOLD_SEC);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_UNANSWERED_THRESHOLD_SEC;
  return Math.min(Math.floor(raw), 86_400);
}

/** Truncate inbound preview; never store secrets-looking blobs. */
export function truncateBodyPreview(text: unknown, max = BODY_PREVIEW_MAX): string {
  return String(text ?? '')
    .replace(/[\u0000-\u001F]/g, '')
    .trim()
    .slice(0, max);
}

/**
 * True when customer message is older than threshold and staff has not replied after it.
 */
export function isUnansweredConversation(
  row: UnansweredConversationRow,
  now: Date,
  thresholdSec = DEFAULT_UNANSWERED_THRESHOLD_SEC,
): boolean {
  if (row.status === 'closed') return false;
  const customerAt = asDate(row.lastCustomerMessageAt);
  if (!customerAt) return false;
  const ageSec = (now.getTime() - customerAt.getTime()) / 1000;
  if (ageSec < thresholdSec) return false;
  const staffAt = asDate(row.lastStaffReplyAt);
  if (staffAt && staffAt.getTime() >= customerAt.getTime()) return false;
  return true;
}

/**
 * Idempotent scan: one open/acked alert per conversation until resolved.
 * `acked` still counts as open for storm prevention (panel seen, not closed).
 */
export function evaluateUnansweredAlerts(
  now: Date,
  rows: UnansweredConversationRow[],
  openAlerts: OpenAlertKey[],
  thresholdSec = DEFAULT_UNANSWERED_THRESHOLD_SEC,
): UnansweredEvalDecision[] {
  const openSet = new Set(
    openAlerts
      .filter((a) => a.status === 'open' || a.status === 'acked')
      .map((a) => a.conversationId),
  );
  const out: UnansweredEvalDecision[] = [];
  for (const row of rows) {
    const id = String(row.conversationId || '');
    if (!id) continue;
    if (row.status === 'closed') {
      out.push({ action: 'skip', conversationId: id, reason: 'closed' });
      continue;
    }
    const customerAt = asDate(row.lastCustomerMessageAt);
    if (!customerAt) {
      out.push({ action: 'skip', conversationId: id, reason: 'no_customer_msg' });
      continue;
    }
    const ageSec = Math.floor((now.getTime() - customerAt.getTime()) / 1000);
    if (ageSec < thresholdSec) {
      out.push({ action: 'skip', conversationId: id, reason: 'within_threshold' });
      continue;
    }
    const staffAt = asDate(row.lastStaffReplyAt);
    if (staffAt && staffAt.getTime() >= customerAt.getTime()) {
      out.push({ action: 'skip', conversationId: id, reason: 'answered' });
      continue;
    }
    if (openSet.has(id)) {
      out.push({ action: 'skip', conversationId: id, reason: 'open_alert_exists' });
      continue;
    }
    out.push({
      action: 'raise',
      conversationId: id,
      destinationId: String(row.destinationId || ''),
      ageSec,
    });
  }
  return out;
}

/** Persian panel copy — no fabricated chat ids. */
export function unansweredOwnerNotifyText(input: {
  destinationLabel: string;
  provider: string;
  ageSec: number;
}): string {
  const label = String(input.destinationLabel || 'کانال').slice(0, 80);
  const age = Math.max(0, Math.floor(input.ageSec));
  return `هشدار بی‌پاسخ: پیام مشتری در «${label}» (${String(input.provider || '').toUpperCase()}) بیش از ${age} ثانیه بدون پاسخ مانده است.`;
}

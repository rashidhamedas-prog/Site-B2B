import { maskMobile } from '../domain/phone';
import { masksAudiencePhone, sourcePriority, type AudienceSource } from './audience.types';

export const DLR_WINDOW_MS = 72 * 60 * 60 * 1000;
const BACKOFF_MS = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000, 6 * 60 * 60 * 1000];

export const REPORT_SOURCES = ['WHOLESALE', 'WHOLESALE_REFERRAL', 'SALES_PARTNER', 'RETAIL'] as const;

export type DlrRow = {
  createdAt: Date;
  dlrCheckedAt?: Date | null;
  dlrAttempts?: number;
  status?: string;
  deliveryState?: string | null;
  source?: string | null;
  segmentId?: string | null;
  campaignId?: string | null;
};

export type DlrOutcome = 'skip' | 'expire' | 'unchanged' | 'delivered' | 'undelivered';

export function backoffDelayMs(attempts: number): number {
  const index = Math.min(Math.max(attempts, 1) - 1, BACKOFF_MS.length - 1);
  return BACKOFF_MS[index];
}

export function dlrIsDue(row: DlrRow, now: Date): boolean {
  if (now.getTime() - row.createdAt.getTime() > DLR_WINDOW_MS) return false;
  if (!row.dlrCheckedAt) return true;
  const next = row.dlrCheckedAt.getTime() + backoffDelayMs(row.dlrAttempts || 1);
  return next <= now.getTime();
}

/** Null check time first, so a row older than the newest 100 is still selected. */
export function selectDlrCandidates<T extends DlrRow>(rows: T[], now: Date, limit = 100): T[] {
  return rows
    .filter((row) => dlrIsDue(row, now))
    .sort((a, b) => {
      if (!a.dlrCheckedAt && !b.dlrCheckedAt) return a.createdAt.getTime() - b.createdAt.getTime();
      if (!a.dlrCheckedAt) return -1;
      if (!b.dlrCheckedAt) return 1;
      return a.dlrCheckedAt.getTime() - b.dlrCheckedAt.getTime();
    })
    .slice(0, limit);
}

export function isPastDlrWindow(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() > DLR_WINDOW_MS;
}

export function mapProviderDeliveryState(raw: string | null | undefined): 'DELIVERED' | 'UNDELIVERED' | 'PENDING' | 'UNKNOWN' {
  const state = String(raw || '').toLowerCase();
  if (!state) return 'UNKNOWN';
  if (state.includes('deliver') && !state.includes('undeliver')) return 'DELIVERED';
  if (state.includes('undeliver') || state.includes('fail')) return 'UNDELIVERED';
  if (state.includes('pending') || state.includes('sent')) return 'PENDING';
  return 'UNKNOWN';
}

export function classifyDlr(input: {
  createdAt: Date;
  now: Date;
  providerError?: boolean;
  providerState?: string | null;
}): DlrOutcome {
  if (isPastDlrWindow(input.createdAt, input.now)) return 'expire';
  if (input.providerError) return 'unchanged';
  const mapped = mapProviderDeliveryState(input.providerState);
  if (mapped === 'DELIVERED') return 'delivered';
  if (mapped === 'UNDELIVERED') return 'undelivered';
  return 'unchanged';
}

export function primaryAudienceSource(sources: readonly string[]): AudienceSource | null {
  const known = sources.filter((source): source is AudienceSource =>
    (REPORT_SOURCES as readonly string[]).includes(source),
  );
  if (!known.length) return null;
  return [...known].sort((a, b) => sourcePriority(a) - sourcePriority(b))[0];
}

export function tehranDayStart(now = new Date()): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now);
  return new Date(`${ymd}T00:00:00+03:30`);
}

export function summarizeSmsReports(rows: DlrRow[], now = new Date()) {
  const start = tehranDayStart(now);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const inDay = (row: DlrRow) => row.createdAt >= start && row.createdAt < end;
  const today = rows.filter(inDay);
  const sentToday = today.filter((row) => row.status === 'SENT').length;
  const deliveredToday = today.filter(
    (row) => row.status === 'DELIVERED' || row.deliveryState === 'DELIVERED',
  ).length;
  const week = rows.filter((row) => row.createdAt >= weekStart);
  const deliveredWeek = week.filter(
    (row) => row.status === 'DELIVERED' || row.deliveryState === 'DELIVERED',
  ).length;
  const terminal = week.filter((row) =>
    ['SENT', 'DELIVERED', 'UNDELIVERED', 'FAILED'].includes(row.status || ''),
  ).length;
  const bySource: Record<string, { sent: number; delivered: number }> = {};
  for (const source of REPORT_SOURCES) bySource[source] = { sent: 0, delivered: 0 };
  for (const row of today) {
    const source = row.source && bySource[row.source] ? row.source : null;
    if (!source) continue;
    if (row.status === 'SENT') bySource[source].sent += 1;
    if (row.status === 'DELIVERED' || row.deliveryState === 'DELIVERED') bySource[source].delivered += 1;
  }
  return {
    sentToday,
    deliveredToday,
    deliveryRate7d: terminal ? deliveredWeek / terminal : 0,
    bySource,
  };
}

export function csvPhone(phone: string, role: string): string {
  return masksAudiencePhone(role) ? maskMobile(phone) : phone;
}

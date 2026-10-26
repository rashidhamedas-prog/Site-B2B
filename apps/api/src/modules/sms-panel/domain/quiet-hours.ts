/** PROMO quiet hours in Asia/Tehran. Default 08:00–21:00 (end exclusive for send-at-end). */

export interface PromoWindow {
  start: string; // HH:MM
  end: string;   // HH:MM
}

export const DEFAULT_PROMO_WINDOW: PromoWindow = { start: '08:00', end: '21:00' };

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = String(hm || '').split(':').map((x) => parseInt(x, 10));
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

/** Minutes from midnight in Asia/Tehran for a Date. */
export function tehranMinutesOfDay(now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return hour * 60 + minute;
}

export function isWithinPromoWindow(
  now: Date = new Date(),
  window: PromoWindow = DEFAULT_PROMO_WINDOW,
): boolean {
  const cur = tehranMinutesOfDay(now);
  const s = parseHm(window.start);
  const e = parseHm(window.end);
  const startMin = s.h * 60 + s.m;
  const endMin = e.h * 60 + e.m;
  if (startMin === endMin) return true; // degenerate = always open
  if (startMin < endMin) return cur >= startMin && cur < endMin;
  // overnight window
  return cur >= startMin || cur < endMin;
}

/** Next Date (UTC instant) when window opens, if currently closed; else null. */
export function nextPromoWindowOpen(
  now: Date = new Date(),
  window: PromoWindow = DEFAULT_PROMO_WINDOW,
): Date | null {
  if (isWithinPromoWindow(now, window)) return null;
  // Brute-force forward in 1-minute steps up to 48h (deterministic, no TZ lib).
  for (let i = 1; i <= 48 * 60; i++) {
    const candidate = new Date(now.getTime() + i * 60_000);
    if (isWithinPromoWindow(candidate, window)) return candidate;
  }
  return new Date(now.getTime() + 24 * 60 * 60_000);
}

export function isOfficialPromoWindow(window: PromoWindow): boolean {
  return window.start === '08:00' && window.end === '21:00';
}

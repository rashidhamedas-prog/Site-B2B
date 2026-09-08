/** Tehran wall-clock helpers. Offset is +03:30 (no DST). */

export const TEHRAN_UTC_OFFSET_MINUTES = 210;

export function tehranHour(now: Date, offsetMinutes = TEHRAN_UTC_OFFSET_MINUTES): number {
  const shifted = new Date(now.getTime() + offsetMinutes * 60_000);
  return shifted.getUTCHours();
}

export function tehranDayStart(now: Date, offsetMinutes = TEHRAN_UTC_OFFSET_MINUTES): Date {
  const shifted = new Date(now.getTime() + offsetMinutes * 60_000);
  const startShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(startShifted - offsetMinutes * 60_000);
}

/** Window may wrap midnight (e.g. 21 → 9). start === end means no window. */
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

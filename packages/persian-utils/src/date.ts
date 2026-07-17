// Jalali (Shamsi) date utilities — no external deps for the simple cases
// Uses built-in Intl.DateTimeFormat with Persian calendar where available,
// falls back to manual conversion for environments without full ICU support.

const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند',
];

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toPersian(n: number, pad = 0): string {
  return String(n)
    .padStart(pad, '0')
    .replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d)]);
}

function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_no = [0, 31, 59 + (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0) ? 1 : 0), 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy - 1600;
  let jm: number, jd: number;
  let g_day_no = 365 * (gy - 1) + Math.floor((gy - 1) / 4) - Math.floor((gy - 1) / 100) + Math.floor((gy - 1) / 400);
  g_day_no += g_d_no[gm - 1] + gd - 1;
  let j_day_no = g_day_no - 79;
  const j_np = Math.floor(j_day_no / 12053);
  j_day_no %= 12053;
  jy += 33 * j_np + 4 * Math.floor(j_day_no / 1461);
  j_day_no %= 1461;
  if (j_day_no >= 366) {
    jy += Math.floor((j_day_no - 1) / 365);
    j_day_no = (j_day_no - 1) % 365;
  }
  for (let i = 0; i < 11 && j_day_no >= (i < 6 ? 31 : 30); ++i) {
    j_day_no -= i < 6 ? 31 : 30;
    jm = i + 2;
  }
  jm = (jm! ?? 1);
  jd = j_day_no + 1;
  return [jy, jm, jd];
}

/** Convert a Date (or ISO string) to Jalali date parts */
export function toJalali(date: Date | string): { year: number; month: number; day: number; monthName: string } {
  const d = typeof date === 'string' ? new Date(date) : date;
  const [year, month, day] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return { year, month, day, monthName: JALALI_MONTHS[month - 1] };
}

/** Format date as ۱۴۰۲/۰۴/۰۶ */
export function formatJalaliDate(date: Date | string): string {
  const { year, month, day } = toJalali(date);
  return `${toPersian(year)}/${toPersian(month, 2)}/${toPersian(day, 2)}`;
}

/** Format date as ۶ تیر ۱۴۰۲ */
export function formatJalaliDateFull(date: Date | string): string {
  const { year, month, day, monthName } = toJalali(date);
  return `${toPersian(day)} ${monthName} ${toPersian(year)}`;
}

/** Format as YYYY/MM/DD string (for storage) */
export function toJalaliString(date: Date | string): string {
  const { year, month, day } = toJalali(date);
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

/** Get current Jalali year */
export function getCurrentJalaliYear(): number {
  return toJalali(new Date()).year;
}

function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  const jy2 = jy - 979;
  const jm2 = jm - 1;
  const jd2 = jd - 1;
  let jDayNo = 365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4);
  for (let i = 0; i < jm2; ++i) jDayNo += i < 6 ? 31 : 30;
  jDayNo += jd2;
  let gDayNo = jDayNo + 79;
  let gy = 1600 + 400 * Math.floor(gDayNo / 146097);
  gDayNo %= 146097;
  let leap = true;
  if (gDayNo >= 36525) {
    gDayNo--;
    gy += 100 * Math.floor(gDayNo / 36524);
    gDayNo %= 36524;
    if (gDayNo >= 365) gDayNo++;
    else leap = false;
  }
  gy += 4 * Math.floor(gDayNo / 1461);
  gDayNo %= 1461;
  if (gDayNo >= 366) {
    leap = false;
    gDayNo--;
    gy += Math.floor(gDayNo / 365);
    gDayNo %= 365;
  }
  const salA = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 1; gm <= 12 && gDayNo >= salA[gm]; gm++) gDayNo -= salA[gm];
  return [gy, gm, gDayNo + 1];
}

/** Parse Jalali YYYY/MM/DD (or YYYY-MM-DD) to Date at local noon */
export function fromJalaliString(input: string): Date | null {
  const m = String(input ?? '').trim().replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (!m) return null;
  const jy = Number(m[1]);
  const jm = Number(m[2]);
  const jd = Number(m[3]);
  if (!jy || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd, 12, 0, 0);
}

/** Relative time in Persian (e.g., "۳ روز پیش") */
export function formatRelativeTimeFa(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diff < 60) return 'همین الان';
  if (diff < 3600) return `${toPersian(Math.floor(diff / 60))} دقیقه پیش`;
  if (diff < 86400) return `${toPersian(Math.floor(diff / 3600))} ساعت پیش`;
  if (diff < 2592000) return `${toPersian(Math.floor(diff / 86400))} روز پیش`;
  if (diff < 31536000) return `${toPersian(Math.floor(diff / 2592000))} ماه پیش`;
  return `${toPersian(Math.floor(diff / 31536000))} سال پیش`;
}

import { DEFAULT_PROMO_WINDOW, type PromoWindow } from './domain/quiet-hours';

export interface SmsPanelSettings {
  promoWindowStart: string;
  promoWindowEnd: string;
  promoPerDay: number;
  promoPerWeek: number;
  creditWarnThreshold: number;
  testNumbers: string[];
  otpCooldownSeconds: number;
  /** Rial per part. Null until a manager sets it. Never default a number. */
  unitPricePerPart: number | null;
}

export const DEFAULT_SMS_PANEL_SETTINGS: SmsPanelSettings = {
  promoWindowStart: DEFAULT_PROMO_WINDOW.start,
  promoWindowEnd: DEFAULT_PROMO_WINDOW.end,
  promoPerDay: 1,
  promoPerWeek: 3,
  creditWarnThreshold: 500,
  testNumbers: [],
  otpCooldownSeconds: 60,
  unitPricePerPart: null,
};

export const SMS_PANEL_SETTINGS_KEY = 'smsPanel';

export function resolveSmsPanelSettings(raw?: unknown): SmsPanelSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const start = String(src.promoWindowStart || DEFAULT_SMS_PANEL_SETTINGS.promoWindowStart);
  const end = String(src.promoWindowEnd || DEFAULT_SMS_PANEL_SETTINGS.promoWindowEnd);
  const testNumbers = Array.isArray(src.testNumbers)
    ? (src.testNumbers as unknown[]).map((x) => String(x)).filter(Boolean).slice(0, 5)
    : [];
  return {
    promoWindowStart: /^\d{2}:\d{2}$/.test(start) ? start : DEFAULT_SMS_PANEL_SETTINGS.promoWindowStart,
    promoWindowEnd: /^\d{2}:\d{2}$/.test(end) ? end : DEFAULT_SMS_PANEL_SETTINGS.promoWindowEnd,
    promoPerDay: Math.max(0, Number(src.promoPerDay) || DEFAULT_SMS_PANEL_SETTINGS.promoPerDay),
    promoPerWeek: Math.max(0, Number(src.promoPerWeek) || DEFAULT_SMS_PANEL_SETTINGS.promoPerWeek),
    creditWarnThreshold: Math.max(
      0,
      Number(src.creditWarnThreshold) || DEFAULT_SMS_PANEL_SETTINGS.creditWarnThreshold,
    ),
    testNumbers,
    otpCooldownSeconds: Math.max(
      30,
      Number(src.otpCooldownSeconds) || DEFAULT_SMS_PANEL_SETTINGS.otpCooldownSeconds,
    ),
    unitPricePerPart:
      typeof src.unitPricePerPart === 'number' &&
      Number.isFinite(src.unitPricePerPart) &&
      src.unitPricePerPart >= 0
        ? Math.floor(src.unitPricePerPart)
        : null,
  };
}

export function promoWindowFromSettings(s: SmsPanelSettings): PromoWindow {
  return { start: s.promoWindowStart, end: s.promoWindowEnd };
}

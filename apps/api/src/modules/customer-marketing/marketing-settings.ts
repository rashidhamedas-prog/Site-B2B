import {
  DEFAULT_MARKETING_SETTINGS,
  MARKETING_MODES,
  type MarketingMode,
  type MarketingSettings,
} from './customer-marketing.constants';

export function resolveMarketingSettings(raw: Record<string, unknown> | null | undefined): MarketingSettings {
  const s = raw && typeof raw === 'object' ? raw : {};
  const modeRaw = String(s.mode || DEFAULT_MARKETING_SETTINGS.mode).toUpperCase();
  const mode = (MARKETING_MODES as readonly string[]).includes(modeRaw) ? modeRaw as MarketingMode : 'OFF';
  const scenarioModes: Record<string, MarketingMode> = {};
  const rawModes = s.scenarioModes && typeof s.scenarioModes === 'object'
    ? s.scenarioModes as Record<string, unknown>
    : {};
  for (const [key, value] of Object.entries(rawModes)) {
    const m = String(value || '').toUpperCase();
    if ((MARKETING_MODES as readonly string[]).includes(m)) {
      scenarioModes[key] = m as MarketingMode;
    }
  }
  return {
    enabled: s.enabled === true && (mode === 'CANARY' || mode === 'LIVE'),
    mode,
    quietStartHour: numOr(s.quietStartHour, DEFAULT_MARKETING_SETTINGS.quietStartHour),
    quietEndHour: numOr(s.quietEndHour, DEFAULT_MARKETING_SETTINGS.quietEndHour),
    nurturePerPhonePerDay: numOr(s.nurturePerPhonePerDay, DEFAULT_MARKETING_SETTINGS.nurturePerPhonePerDay),
    promoPerPhonePerDay: numOr(s.promoPerPhonePerDay, DEFAULT_MARKETING_SETTINGS.promoPerPhonePerDay),
    promoMinGapHours: numOr(s.promoMinGapHours, DEFAULT_MARKETING_SETTINGS.promoMinGapHours),
    dailyCapPerChannel: numOr(s.dailyCapPerChannel, DEFAULT_MARKETING_SETTINGS.dailyCapPerChannel),
    treatRegisterAutoAsPromoConsent: s.treatRegisterAutoAsPromoConsent === true,
    canaryPhoneRetail: String(s.canaryPhoneRetail || ''),
    canaryPhoneWholesale: String(s.canaryPhoneWholesale || ''),
    scenarioModes,
  };
}

function numOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

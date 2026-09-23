export const SALES_PARTNER_SETTINGS_KEY = 'salesPartners';
export const SALES_PARTNER_MODES = ['OFF', 'PREVIEW', 'CANARY', 'LIVE'] as const;
export type SalesPartnerMode = (typeof SALES_PARTNER_MODES)[number];

export type SalesPartnerSettings = {
  enabled: boolean;
  mode: SalesPartnerMode;
  applyOpen: boolean;
  draftTtlHours: number;
  confirmResendCooldownSeconds: number;
  confirmResendDailyCap: number;
  commissionHoldDays: number | null;
  minPayoutIrr: number;
  minMarginIrr: number;
  dailyDraftCap: number;
  priceDriftMaxBps: number;
  blockSelfReferral: boolean;
  termsVersion: string;
  canaryPhone: string;
};

export const DEFAULT_SALES_PARTNER_SETTINGS: SalesPartnerSettings = {
  enabled: false,
  mode: 'OFF',
  applyOpen: false,
  draftTtlHours: 48,
  confirmResendCooldownSeconds: 60,
  confirmResendDailyCap: 5,
  commissionHoldDays: null,
  minPayoutIrr: 0,
  minMarginIrr: 0,
  dailyDraftCap: 20,
  priceDriftMaxBps: 0,
  blockSelfReferral: true,
  termsVersion: 'draft-unreviewed',
  canaryPhone: '',
};

function numOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

export function resolveSalesPartnerSettings(raw: Record<string, unknown> | null | undefined): SalesPartnerSettings {
  const s = raw && typeof raw === 'object' ? raw : {};
  const modeRaw = String(s.mode || DEFAULT_SALES_PARTNER_SETTINGS.mode).toUpperCase();
  const mode = (SALES_PARTNER_MODES as readonly string[]).includes(modeRaw)
    ? (modeRaw as SalesPartnerMode)
    : 'OFF';
  const holdRaw = s.commissionHoldDays;
  const hold = holdRaw === null || holdRaw === undefined || holdRaw === ''
    ? null
    : numOr(holdRaw, -1);
  return {
    enabled: s.enabled === true && (mode === 'CANARY' || mode === 'LIVE'),
    mode,
    applyOpen: s.applyOpen === true && (mode === 'PREVIEW' || mode === 'CANARY' || mode === 'LIVE'),
    draftTtlHours: Math.min(168, Math.max(1, numOr(s.draftTtlHours, DEFAULT_SALES_PARTNER_SETTINGS.draftTtlHours))),
    confirmResendCooldownSeconds: Math.min(
      3600,
      Math.max(30, numOr(s.confirmResendCooldownSeconds, DEFAULT_SALES_PARTNER_SETTINGS.confirmResendCooldownSeconds)),
    ),
    confirmResendDailyCap: Math.min(20, Math.max(1, numOr(s.confirmResendDailyCap, DEFAULT_SALES_PARTNER_SETTINGS.confirmResendDailyCap))),
    commissionHoldDays: hold !== null && hold > 0 && hold <= 180 ? hold : null,
    minPayoutIrr: Math.max(0, numOr(s.minPayoutIrr, 0)),
    minMarginIrr: Math.max(0, numOr(s.minMarginIrr, 0)),
    dailyDraftCap: Math.min(100, Math.max(1, numOr(s.dailyDraftCap, DEFAULT_SALES_PARTNER_SETTINGS.dailyDraftCap))),
    priceDriftMaxBps: Math.min(2000, Math.max(0, numOr(s.priceDriftMaxBps, 0))),
    blockSelfReferral: s.blockSelfReferral !== false,
    termsVersion: String(s.termsVersion || DEFAULT_SALES_PARTNER_SETTINGS.termsVersion).slice(0, 40),
    canaryPhone: String(s.canaryPhone || ''),
  };
}

export function programAllowsApply(settings: SalesPartnerSettings): boolean {
  return settings.applyOpen && settings.mode !== 'OFF';
}

export function programAllowsPartnerAction(settings: SalesPartnerSettings, phone: string): boolean {
  if (settings.mode === 'OFF') return false;
  if (settings.mode === 'PREVIEW') return false;
  if (settings.mode === 'CANARY') return settings.enabled && phone === settings.canaryPhone;
  return settings.enabled;
}

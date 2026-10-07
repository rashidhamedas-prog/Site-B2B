import { SALES_PARTNER_SETTINGS_KEY, resolveSalesPartnerSettings } from './sales-partner-settings';

/** Live storefront settings live here. `system_settings` is not a table in this app. */
export const SALES_PARTNER_SETTINGS_TABLE = 'app_settings';

export function salesPartnerProgramSettingsSql(): { sql: string; params: [string] } {
  return {
    sql: `SELECT value FROM ${SALES_PARTNER_SETTINGS_TABLE} WHERE key = $1 LIMIT 1`,
    params: [SALES_PARTNER_SETTINGS_KEY],
  };
}

export function salesPartnerCheckoutAttributionOpen(raw: unknown): {
  open: boolean;
  mode: string;
  canaryPhone: string;
} {
  const settings = resolveSalesPartnerSettings(
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null,
  );
  return {
    open: settings.enabled && (settings.mode === 'LIVE' || settings.mode === 'CANARY'),
    mode: settings.mode,
    canaryPhone: settings.canaryPhone,
  };
}

/** Attribution must not fail retail checkout. Missing/legacy tables → treat as no partner link. */
export function softFailSalesPartnerLinkQuery(message: string): boolean {
  return /app_settings|system_settings|sales_partner_profiles|sales_partner_product_eligibility|publicCode|salesPartnerProductIds/i.test(
    message,
  );
}

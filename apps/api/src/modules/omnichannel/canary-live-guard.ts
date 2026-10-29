/**
 * Canary vs live-primary destination guardrails (panel urgent 2026-10-29).
 * HARD STOP: never auto-clear/remap Bale chat 4858359991 (documented dual-role wholesale).
 * Rubika wholesale @Toliditaranom_omde must not become a test destination.
 */

export const BALE_CANARY_CHAT_ID = '4858359991';
export const BALE_CANARY_USERNAME = 'toliditaranom';
export const RUBIKA_WHOLESALE_LIVE_KEY = 'toliditaranom_omde';

export type CanaryProvider = 'TELEGRAM' | 'BALE' | 'RUBIKA';
export type CanaryChannel = 'RETAIL' | 'WHOLESALE';

function normalizeKey(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

/** Documented dual-role Bale wholesale canary — STOP: do not clear isCanary in this PR. */
export function isDocumentedBaleCanaryKey(destinationKey: string): boolean {
  const key = normalizeKey(destinationKey);
  return key === BALE_CANARY_CHAT_ID || key === BALE_CANARY_USERNAME;
}

export function isRubikaWholesaleLiveKey(destinationKey: string, displayName?: string): boolean {
  const key = normalizeKey(destinationKey);
  if (key === RUBIKA_WHOLESALE_LIVE_KEY || key === `@${RUBIKA_WHOLESALE_LIVE_KEY}`.replace(/^@/, '')) {
    return true;
  }
  const name = normalizeKey(displayName || '');
  return name.includes('toliditaranom_omde') || name.includes('تولیدی ترنم عمده') || name.includes('عمده روبیکا');
}

export function looksLikeLivePrimaryChannel(input: {
  destinationKey: string;
  displayName?: string;
  provider: CanaryProvider;
  channel: CanaryChannel;
  verifiedCanPost?: boolean;
}): { livePrimary: boolean; reason: string } {
  if (input.provider === 'BALE' && isDocumentedBaleCanaryKey(input.destinationKey)) {
    return {
      livePrimary: true,
      reason: 'documented_bale_wholesale_canary_dual_role',
    };
  }
  if (
    input.provider === 'RUBIKA'
    && input.channel === 'WHOLESALE'
    && isRubikaWholesaleLiveKey(input.destinationKey, input.displayName)
  ) {
    return { livePrimary: true, reason: 'rubika_wholesale_live' };
  }
  const name = String(input.displayName || '').trim();
  const looksProdName =
    /کانال\s*(عمده|تکی|فروش)|عمده\s*زنده|live\s*channel|production/i.test(name)
    || (input.channel === 'WHOLESALE' && /عمده/.test(name) && !/تست|آزمایش|canary|test/i.test(name));
  if (input.verifiedCanPost === true && looksProdName) {
    return { livePrimary: true, reason: 'verified_live_primary_name' };
  }
  if (input.verifiedCanPost === true && !/تست|آزمایش|canary|test/i.test(name + input.destinationKey)) {
    // Verified canPost without an explicit test marker → treat as live-primary for force gate.
    return { livePrimary: true, reason: 'verified_can_post_non_test' };
  }
  return { livePrimary: false, reason: 'not_live_primary' };
}

export type AssertCanaryToggleResult =
  | { ok: true; canaryIsLivePrimaryWarning?: boolean }
  | {
      ok: false;
      code: 'live_primary_needs_force' | 'blocked_rubika_wholesale_canary';
      messageFa: string;
    };

/**
 * When wantCanary=true: block Rubika wholesale live; require force+goRef for other live-primary;
 * allow documented Bale dual-role with warning flag only (never reject/clear).
 */
export function assertCanaryToggleAllowed(input: {
  wantCanary: boolean;
  destinationKey: string;
  displayName?: string;
  provider: CanaryProvider;
  channel: CanaryChannel;
  verifiedCanPost?: boolean;
  forceCanaryOnLive?: boolean;
  goRef?: string;
}): AssertCanaryToggleResult {
  if (!input.wantCanary) {
    return { ok: true };
  }

  if (
    input.provider === 'RUBIKA'
    && input.channel === 'WHOLESALE'
    && isRubikaWholesaleLiveKey(input.destinationKey, input.displayName)
  ) {
    return {
      ok: false,
      code: 'blocked_rubika_wholesale_canary',
      messageFa:
        'مقصد عمده روبیکا (@Toliditaranom_omde) نمی‌تواند مقصد آزمایشی باشد. canary فقط برای اتاق تست جدا است.',
    };
  }

  if (input.provider === 'BALE' && isDocumentedBaleCanaryKey(input.destinationKey)) {
    return { ok: true, canaryIsLivePrimaryWarning: true };
  }

  const look = looksLikeLivePrimaryChannel({
    destinationKey: input.destinationKey,
    displayName: input.displayName,
    provider: input.provider,
    channel: input.channel,
    verifiedCanPost: input.verifiedCanPost,
  });

  if (!look.livePrimary) {
    return { ok: true };
  }

  const force = input.forceCanaryOnLive === true;
  const goRef = String(input.goRef || '').trim();
  if (!force || !goRef) {
    return {
      ok: false,
      code: 'live_primary_needs_force',
      messageFa:
        'این مقصد شبیه کانال زنده است. برای علامت آزمایشی به تأیید مالک (forceCanaryOnLive + goRef) نیاز است.',
    };
  }
  return { ok: true, canaryIsLivePrimaryWarning: true };
}

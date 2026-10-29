/**
 * PR-10 — server-side product-claim guard for templates / captions (REQ-C7 / D5).
 * Blocks «ضدآب» and ZWNJ/spaced variants; max body length for template drafts.
 */
import {
  assertNoForbiddenProductClaims,
  findForbiddenProductClaim,
  FORBIDDEN_PRODUCT_CLAIMS,
  normalizeClaimText,
} from './channel-settings';

export {
  assertNoForbiddenProductClaims,
  findForbiddenProductClaim,
  FORBIDDEN_PRODUCT_CLAIMS,
  normalizeClaimText,
};

/** Soft cap on template body JSON / text (matches entity practical size). */
export const TEMPLATE_BODY_MAX_CHARS = 16_000;

export function assertTemplateBodyClaims(body: string): void {
  const text = String(body || '');
  if (text.length > TEMPLATE_BODY_MAX_CHARS) {
    const err = new Error(`طول قالب بیش از ${TEMPLATE_BODY_MAX_CHARS} کاراکتر است`);
    (err as Error & { code?: string }).code = 'template_body_too_long';
    throw err;
  }
  assertNoForbiddenProductClaims(text);
}

/** True when body/layout JSON contains a forbidden claim substring. */
export function templateBodyHasForbiddenClaim(body: string): boolean {
  return findForbiddenProductClaim(body) != null;
}

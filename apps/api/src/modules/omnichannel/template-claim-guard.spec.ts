/**
 * npx ts-node --transpile-only src/modules/omnichannel/template-claim-guard.spec.ts
 */
import {
  assertTemplateBodyClaims,
  findForbiddenProductClaim,
  TEMPLATE_BODY_MAX_CHARS,
} from './template-claim-guard';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(findForbiddenProductClaim('ضدآب') === 'ضدآب', 'blocks ضدآب');
assert(findForbiddenProductClaim('ضد آب') === 'ضدآب', 'blocks spaced');
assert(findForbiddenProductClaim('ضد‌آب') === 'ضدآب', 'blocks ZWNJ');
assert(findForbiddenProductClaim('مقاوم در برابر آب') === null, 'allows alternate wording');

try {
  assertTemplateBodyClaims('کپشن ضدآب محصول');
  assert(false, 'must reject');
} catch (err) {
  assert(err instanceof Error && err.message.includes('ضدآب'), 'Persian error');
}

assertTemplateBodyClaims('{name} — {price}\n{url}\n{minOrder}');

try {
  assertTemplateBodyClaims('x'.repeat(TEMPLATE_BODY_MAX_CHARS + 1));
  assert(false, 'must reject oversized');
} catch (err) {
  assert(err instanceof Error && (err as Error & { code?: string }).code === 'template_body_too_long', 'length code');
}

console.log('template-claim-guard.spec.ts: ok');

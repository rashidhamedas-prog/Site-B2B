/**
 * npx ts-node --transpile-only src/modules/erp-inventory/erp-text-normalize.spec.ts
 */
import { normalizeErpLabel, variantMatchKey } from './erp-text-normalize';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(normalizeErpLabel('  مشکی  ') === 'مشکی', 'trim');
assert(normalizeErpLabel('سياه') === 'سیاه', 'arabic yeh');
assert(normalizeErpLabel('سايز ۱') === 'سایز 1', 'persian digit + arabic yeh');
assert(normalizeErpLabel('سایز\u200c۱') === 'سایز1', 'zwnj stripped then digit');
assert(variantMatchKey('مشکی', 'سایز ۱') === 'مشکی|سایز 1', 'match key');
assert(variantMatchKey('مشکی', 'سایز 1') === variantMatchKey('مشکی', 'سایز ۱'), 'digit parity');
assert(
  normalizeErpLabel('فری سایز (مناسب تا 48)') === normalizeErpLabel('فری سایز'),
  'free-size paren stripped',
);
assert(
  variantMatchKey('سبز کاهویی', 'فری سایز (مناسب تا 48)') ===
    variantMatchKey('سبز کاهویی', 'فری سایز'),
  'color+free-size key parity',
);

console.log('erp-text-normalize.spec.ts: ok');

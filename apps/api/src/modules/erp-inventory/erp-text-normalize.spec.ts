/**
 * npx ts-node --transpile-only src/modules/erp-inventory/erp-text-normalize.spec.ts
 */
import { normalizeErpLabel, variantMatchKey } from './erp-text-normalize';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(normalizeErpLabel('  مشکی  ') === 'مشکی', 'trim');
assert(normalizeErpLabel('سياه') === 'سیاه', 'arabic yeh');
assert(normalizeErpLabel('سايز ۱') === 'سایز1', 'persian digit + arabic yeh');
assert(normalizeErpLabel('سایز\u200c۱') === 'سایز1', 'zwnj stripped then digit');
assert(variantMatchKey('مشکی', 'سایز ۱') === 'مشکی|سایز1', 'match key');
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
assert(
  variantMatchKey('مشکی', 'سایز 1 (مناسب از 38 تا 42)') === variantMatchKey('مشکی', 'سایز ۱'),
  'erp fit hint matches site size label',
);
assert(
  variantMatchKey('سرمه‌ای', 'سایز 2 (مناسب از 44 تا 48)') === variantMatchKey('سرمه‌ای', 'سایز ۲'),
  'zwnj color + paren size',
);
assert(
  variantMatchKey('قهوه ای', 'فری سایز (مناسب تا 48)') === variantMatchKey('قهوه‌ای', 'فری سایز'),
  'space stands in for zwnj on brown',
);
assert(
  variantMatchKey('سرمه ای', 'سایز 1') === variantMatchKey('سرمه‌ای', 'سایز ۱'),
  'space stands in for zwnj on navy',
);
assert(normalizeErpLabel('کرم') !== normalizeErpLabel('کرمی'), 'extra letter stays different');
assert(
  variantMatchKey('سبز کاهویی', 'سایز 1') !== variantMatchKey('سر کاهویی', 'سایز 1'),
  'different color words stay different',
);

console.log('erp-text-normalize.spec.ts: ok');

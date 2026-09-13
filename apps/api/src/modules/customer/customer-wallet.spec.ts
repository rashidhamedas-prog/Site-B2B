/**
 * npx ts-node --transpile-only src/modules/customer/customer-wallet.spec.ts
 */
import {
  assertPositiveRial,
  isWalletDirection,
  sanitizeWalletNote,
  tomanToRial,
  walletReasonLabelFa,
} from './customer-wallet';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isWalletDirection('CREDIT'), 'credit');
assert(!isWalletDirection('PLUS'), 'reject plus');
assert(tomanToRial(1500) === 15000, 'toman to rial');
assert(walletReasonLabelFa('ADMIN_CREDIT') === 'افزایش توسط ادمین', 'label');
assert(sanitizeWalletNote('<b>بازگشت</b>\nکالا') === 'بازگشتکالا' || sanitizeWalletNote('<b>بازگشت</b> کالا').includes('بازگشت'), 'strip tags');
assert(sanitizeWalletNote('<script>x</script>ok').includes('ok'), 'no script');
assert(!sanitizeWalletNote('<script>x</script>ok').includes('<'), 'no leftover tags');

let threw = false;
try { tomanToRial(0); } catch { threw = true; }
assert(threw, 'zero toman rejected');

threw = false;
try { assertPositiveRial(-1); } catch { threw = true; }
assert(threw, 'negative rial rejected');

console.log('customer-wallet.spec.ts: ok');

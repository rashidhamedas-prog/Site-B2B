/**
 * npx ts-node --transpile-only src/modules/payment/zarinpal-callback-status.spec.ts
 */
import { zarinpalCallbackIsSuccess } from './zarinpal-callback-status';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(zarinpalCallbackIsSuccess('OK'), 'OK is success');
assert(zarinpalCallbackIsSuccess('ok'), 'ok is success (case)');
assert(zarinpalCallbackIsSuccess(''), 'empty follows historical default');
assert(zarinpalCallbackIsSuccess(undefined), 'missing Status still verifies at PSP');
assert(!zarinpalCallbackIsSuccess('NOK'), 'NOK is cancel');
assert(!zarinpalCallbackIsSuccess('nok'), 'nok is cancel');

console.log('zarinpal-callback-status.spec ok');

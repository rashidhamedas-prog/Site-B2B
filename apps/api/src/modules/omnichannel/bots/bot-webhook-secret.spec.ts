import { timingSafeSecretEqual } from './bot-webhook-secret';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(timingSafeSecretEqual('abc', 'abc') === true, 'equal ok');
assert(timingSafeSecretEqual('abc', 'abd') === false, 'mismatch');
assert(timingSafeSecretEqual('ab', 'abc') === false, 'length mismatch');
assert(timingSafeSecretEqual('', '') === false, 'empty fail-closed');

console.log('bot-webhook-secret.spec.ts: ok');

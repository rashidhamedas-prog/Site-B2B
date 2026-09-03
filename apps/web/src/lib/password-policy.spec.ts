import { validateNewPassword } from './password-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(validateNewPassword('1234567') !== null, 'too short');
assert(validateNewPassword('secure12') === null, 'ok');
assert(validateNewPassword('09123456789', '09123456789') !== null, 'phone');

console.log('password-policy.spec.ts: OK');

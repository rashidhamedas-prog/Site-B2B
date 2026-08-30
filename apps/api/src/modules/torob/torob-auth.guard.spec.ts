import { resolveTorobAudience } from './torob-jwt';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const previous = process.env.TOROB_API_AUDIENCE;
process.env.TOROB_API_AUDIENCE = 'www.poshaktaranom.ir';
process.env.HOST = 'evil.example';
process.env.HTTP_HOST = 'api.poshaktaranom.com';

assert(resolveTorobAudience() === 'www.poshaktaranom.ir', 'audience from config only');
assert(resolveTorobAudience() !== process.env.HOST, 'Host cannot change audience');

if (previous == null) delete process.env.TOROB_API_AUDIENCE;
else process.env.TOROB_API_AUDIENCE = previous;

console.log('torob-auth.guard.spec ok');

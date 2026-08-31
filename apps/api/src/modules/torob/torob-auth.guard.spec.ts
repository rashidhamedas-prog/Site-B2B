import { resolveTorobAudience } from './torob-jwt';
import { isTorobOrderPanelProbe, TOROB_ORDERS_REACHABILITY } from './torob.controller';

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

assert(isTorobOrderPanelProbe({}) === true, 'panel probe has no token');
assert(isTorobOrderPanelProbe({ 'x-torob-token': '' }) === true, 'blank token is probe');
assert(isTorobOrderPanelProbe({ 'x-torob-token': 'jwt' }) === false, 'token is not probe');
assert(TOROB_ORDERS_REACHABILITY.success === true, 'orders reachability success');
assert(TOROB_ORDERS_REACHABILITY.data.length === 0, 'orders reachability empty');

console.log('torob-auth.guard.spec ok');

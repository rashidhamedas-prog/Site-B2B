import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const service = readFileSync(join(__dirname, 'sales-partner.service.ts'), 'utf8');
const auth = readFileSync(join(__dirname, 'sales-partner-auth.controller.ts'), 'utf8');
const nginx = readFileSync(join(__dirname, '../../../../../nginx/nginx.conf'), 'utf8');

assert(/isSalesPartnerLoginLocked/.test(service), 'login checks lockout');
assert(/bumpLoginFail|incrWithTtl/.test(service), 'failed login increments redis');
assert(/TOO_MANY_REQUESTS/.test(service), '6th attempt → 429');
assert(/clientIp/.test(auth) && /x-forwarded-for/.test(auth), 'login passes client IP');
const authZones = nginx.match(/location \^~ \/api\/v1\/sales-partners\/auth\//g) || [];
assert(authZones.length >= 2, 'nginx auth zone on both storefront server blocks');
assert(/sales-partners\/auth\/[\s\S]{0,120}limit_req zone=auth/.test(nginx), 'limit_req zone=auth');

console.log('sales-partner-login-lockout-wiring.spec.ts: OK');

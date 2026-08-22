/**
 * npx ts-node --transpile-only src/modules/torob/torob-crawler-ips.spec.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Official Torob crawler ranges (ticket + crawler.torob.com/ips-v4.json 2026-08-22). */
const TOROB_CRAWLER_CIDRS = [
  '81.12.31.192/27',
  '81.12.31.224/28',
  '81.12.31.240/29',
  '81.12.31.248/30',
  '81.12.31.252/31',
  '81.12.31.254/32',
  '91.107.165.81/32',
  '188.121.119.29/32',
  '195.201.30.135/32',
];

const repoRoot = join(__dirname, '../../../../..');
const nginx = readFileSync(join(repoRoot, 'nginx/nginx.conf'), 'utf8');
const nextConfig = readFileSync(join(repoRoot, 'apps/web/next.config.ts'), 'utf8');
const mainTs = readFileSync(join(repoRoot, 'apps/api/src/main.ts'), 'utf8');

assert(/geo \$torob_crawler/.test(nginx), 'nginx geo $torob_crawler missing');
assert(/limit_req_zone \$api_limit_key zone=api/.test(nginx), 'api rate-limit key must skip Torob IPs');
assert(nginx.includes('location = /feeds/torob.xml'), 'feeds/torob.xml alias missing');
assert(nginx.includes('location = /v1/feeds/torob.xml'), 'v1/feeds/torob.xml alias missing');

for (const cidr of TOROB_CRAWLER_CIDRS) {
  assert(nginx.includes(cidr), `nginx allowlist missing ${cidr}`);
}

assert(nextConfig.includes('TorobBot'), 'htmlLimitedBots must include TorobBot');
assert(mainTs.includes('ignoreTrailingSlash: true'), 'Fastify must ignore trailing slash');

const torobBotRe = /TorobBot|Torob-Bot/i;
assert(
  torobBotRe.test('Mozilla/5.0 (compatible; TorobBot/1.0; +https://torob.com/bot)'),
  'TorobBot UA',
);
assert(torobBotRe.test('Torob-Bot'), 'Torob-Bot UA');

console.log('torob-crawler-ips.spec.ts ok');

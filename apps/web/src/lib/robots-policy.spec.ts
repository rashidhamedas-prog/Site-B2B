import assert from 'node:assert/strict';
import { buildRobotsRules, COMMON_DISALLOW, ROBOTS_ALLOW, robotsSitemap } from './robots-policy';

const rules = buildRobotsRules();

assert.equal(rules.length, 2, 'only OAI-SearchBot and *');
assert.deepEqual(
  rules.map((rule) => rule.userAgent),
  ['OAI-SearchBot', '*'],
  'SearchBot is explicit; star stays the catch-all'
);
assert.deepEqual(rules[0]?.allow, ROBOTS_ALLOW);
assert.deepEqual(rules[1]?.allow, ROBOTS_ALLOW);
assert.deepEqual(rules[0]?.disallow, COMMON_DISALLOW);
assert.deepEqual(rules[1]?.disallow, COMMON_DISALLOW);
assert.equal(rules[0]?.allow, rules[1]?.allow, 'same allow list');
assert.equal(rules[0]?.disallow, rules[1]?.disallow, 'same disallow list');

for (const token of ['GPTBot', 'Google-Extended', 'Googlebot']) {
  assert.equal(
    rules.some((rule) => rule.userAgent === token),
    false,
    `${token} must inherit from *`
  );
}

assert.equal(robotsSitemap('WHOLESALE'), 'https://poshaktaranom.com/sitemap.xml');
assert.equal(robotsSitemap('RETAIL'), 'https://www.poshaktaranom.ir/sitemap.xml');

console.log('robots-policy.spec.ts: ok');

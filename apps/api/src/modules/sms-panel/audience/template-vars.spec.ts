import * as assert from 'node:assert/strict';
import { countSmsParts } from '../domain/parts';
import { ensureOptOutFooter } from '../domain/template';
import { QueryRunner } from 'typeorm';
import { SmsTemplateVars1761523500004 } from '../../../database/migrations/20261027-004-sms-template-vars';
import {
  TEMPLATE_VAR_KEYS,
  renderForContact,
  sourceWarnings,
  worstCaseBody,
  TemplateVarError,
  normalizeFallbacks,
  assertTemplateBody,
} from './template-vars';

const fallbacks = {
  name: 'مشتری',
  city: 'تهران',
  businessName: 'فروشگاه',
  partnerName: 'همکار',
  lastOrderNumber: '۱۰۰',
  link: 'https://poshaktaranom.com',
};

for (const key of TEMPLATE_VAR_KEYS) {
  const body = renderForContact(`سلام {${key}}`, { [key]: 'مقدار' }, fallbacks);
  assert.ok(body.includes('مقدار'), key);
}

assert.throws(
  () => renderForContact('سلام {code}', {}, {}),
  (err: unknown) => err instanceof TemplateVarError && /UNKNOWN_PLACEHOLDER:code/.test(err.message),
);

assert.strictEqual(
  renderForContact('سلام {name}', { name: '   ' }, { name: 'مشتری' }),
  'سلام مشتری',
);

assert.strictEqual(renderForContact('{name}', { name: 'ع'.repeat(80) }, {}).length, 40);

const warnings = sourceWarnings('سلام {businessName}', ['RETAIL']);
assert.deepStrictEqual(warnings, [{ key: 'businessName', code: 'SOURCE_MISMATCH' }]);
assert.deepStrictEqual(sourceWarnings('سلام {name}', ['RETAIL']), []);

const worst = ensureOptOutFooter(worstCaseBody('سلام {link}'), 'PROMO');
assert.ok(worst.endsWith('لغو11'));
assert.ok(countSmsParts(worst) >= 2);
assert.strictEqual(countSmsParts('ن'.repeat(70)), 1);
assert.strictEqual(countSmsParts('ن'.repeat(71)), 2);

const rendered = ensureOptOutFooter(renderForContact('سلام {name}', { name: 'علی' }, fallbacks), 'PROMO');
assert.ok(rendered.endsWith('لغو11'));
assert.ok(!rendered.includes('{name}'));

assert.deepStrictEqual(normalizeFallbacks({ name: '  علی  ', secret: 'x' } as Record<string, string>), {
  name: 'علی',
});

async function migrationSql() {
  const calls: string[] = [];
  const runner = {
    async query(sql: string) {
      calls.push(sql);
    },
  } as QueryRunner;
  const migration = new SmsTemplateVars1761523500004();
  await migration.up(runner);
  assert.ok(calls.join('\n').includes('"varFallbacks" jsonb'));
  calls.length = 0;
  await migration.down(runner);
  assert.ok(calls.join('\n').includes('DROP COLUMN IF EXISTS "varFallbacks"'));
}

assert.doesNotThrow(() => assertTemplateBody('کد {code}', null, { messageClass: 'OTP' }));

migrationSql()
  .then(() => {
    console.log('template-vars.spec.ts: ok');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

import * as assert from 'node:assert/strict';
import { countSmsParts, ensureOptOutFooter } from './sms-parts.ts';
import { insertVariable, renderForContact, sourceWarnings, worstCaseBody } from './template-vars.ts';

assert.strictEqual(countSmsParts('ن'.repeat(70)), 1);
assert.strictEqual(countSmsParts('ن'.repeat(71)), 2);
assert.strictEqual(countSmsParts('ن'.repeat(67 * 2)), 2);

const inserted = insertVariable('سلام ', 'name', 5);
assert.strictEqual(inserted.body, 'سلام {name}');
assert.strictEqual(inserted.cursor, 'سلام {name}'.length);
assert.throws(() => insertVariable('x', 'code', 0), /UNKNOWN_PLACEHOLDER/);

assert.strictEqual(renderForContact('سلام {name}', { name: '' }, { name: 'مشتری' }), 'سلام مشتری');
assert.throws(() => renderForContact('{secret}', {}, {}), /UNKNOWN_PLACEHOLDER/);

const body = ensureOptOutFooter(renderForContact('سلام {name}', { name: 'علی' }, {}), 'PROMO');
assert.ok(body.endsWith('لغو11'));
assert.ok(!body.includes('{name}'));

const worst = ensureOptOutFooter(worstCaseBody('سلام {link}'), 'PROMO');
assert.ok(countSmsParts(worst) >= 2);
assert.ok(worst.endsWith('لغو11'));

assert.deepStrictEqual(sourceWarnings('{businessName}', ['RETAIL']), [
  { key: 'businessName', code: 'SOURCE_MISMATCH' },
]);

console.log('template-vars.spec.ts: ok');

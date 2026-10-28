/**
 * npx tsx src/components/admin/sms/sms-send-ui.spec.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PREVIEW_DEBOUNCE_MS,
  buildCitySegmentRules,
  canEditUnitPrice,
  parseUnitPriceInput,
  priceCaption,
} from './sms-send-ui.tsx';

assert.deepEqual(buildCitySegmentRules(''), []);
assert.deepEqual(buildCitySegmentRules('  '), []);
assert.deepEqual(buildCitySegmentRules('تهران'), [{ field: 'city', op: 'in', value: ['تهران'] }]);
assert.deepEqual(buildCitySegmentRules('  کرج '), [{ field: 'city', op: 'in', value: ['کرج'] }]);

assert.equal(priceCaption(null), 'قیمت تنظیم نشده');
assert.equal(priceCaption(undefined), 'قیمت تنظیم نشده');
assert.match(priceCaption(2500), /ریال/);
assert.ok(priceCaption(2500).length > 'ریال'.length);

assert.equal(parseUnitPriceInput(''), null);
assert.equal(parseUnitPriceInput('  '), null);
assert.equal(parseUnitPriceInput('180'), 180);
assert.equal(parseUnitPriceInput('-3'), null);

assert.equal(canEditUnitPrice('ADMIN'), true);
assert.equal(canEditUnitPrice('SMS_MANAGER'), true);
assert.equal(canEditUnitPrice('SMS_MARKETER'), false);
assert.equal(canEditUnitPrice('SMS_OPERATOR'), false);

assert.equal(PREVIEW_DEBOUNCE_MS, 400);

const uiSrc = readFileSync(join(__dirname, 'sms-send-ui.tsx'), 'utf8');
assert.match(uiSrc, /rules\s*=\s*\[\]/);
assert.match(uiSrc, /rules:\s*parsedRules|rules:\s*rules/);
assert.match(uiSrc, /PREVIEW_DEBOUNCE_MS/);
assert.match(uiSrc, /\[sources,\s*text,\s*messageClass,\s*rulesKey\]/);
assert.doesNotMatch(
  uiSrc,
  /post<[^>]*>\('\/admin\/sms\/segments\/preview',\s*\{[^}]*rules:\s*\[\],/,
);

const wizardSrc = readFileSync(join(__dirname, 'AdminSmsWizard.tsx'), 'utf8');
assert.match(wizardSrc, /buildCitySegmentRules\(city\)/);
assert.match(wizardSrc, /rules=\{cityRules\}/);

const settingsSrc = readFileSync(join(__dirname, 'AdminSmsRestPages.tsx'), 'utf8');
assert.match(settingsSrc, /قیمت هر پارت \(ریال\)/);
assert.match(settingsSrc, /canEditUnitPrice/);
assert.match(settingsSrc, /priceCaption/);
assert.match(settingsSrc, /parseUnitPriceInput/);

// City change must yield a distinct preview body (debounce re-fires via rulesKey).
const before = buildCitySegmentRules('');
const after = buildCitySegmentRules('اصفهان');
assert.notDeepEqual(before, after);
assert.notEqual(JSON.stringify(before), JSON.stringify(after));

console.log('sms-send-ui.spec.ts: ok');

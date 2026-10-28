/**
 * node --experimental-strip-types src/components/admin/sms/sms-send-ui.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureOptOutFooter } from './sms-parts.ts';
import {
  buildCitySegmentRules,
  buildSegmentPreviewPayload,
  consumeSegmentPreviewFunnel,
  formatRecipientPreviewStatus,
  priceCaption,
} from './sms-send-preview.ts';
import {
  PREVIEW_DEBOUNCE_MS,
  canEditUnitPrice,
  parseUnitPriceInput,
} from './sms-send-ui.tsx';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const previewBody = ensureOptOutFooter('سلام کمپین', 'PROMO');
assert.ok(previewBody.endsWith('لغو11'));

const payload = buildSegmentPreviewPayload(['WHOLESALE', 'RETAIL'], previewBody, 'PROMO');
assert.deepEqual(payload, {
  sources: ['WHOLESALE', 'RETAIL'],
  text: previewBody,
  messageClass: 'PROMO',
  rules: [],
});
assert.notEqual(payload.text, 'سلام کمپین');
assert.equal(payload.messageClass, 'PROMO');

const withCity = buildSegmentPreviewPayload(
  ['RETAIL'],
  previewBody,
  'PROMO',
  buildCitySegmentRules('اصفهان'),
);
assert.deepEqual(withCity.rules, [{ field: 'city', op: 'in', value: ['اصفهان'] }]);

const transactional = buildSegmentPreviewPayload(
  ['RETAIL'],
  ensureOptOutFooter('خدماتی', 'TRANSACTIONAL'),
  'TRANSACTIONAL',
);
assert.equal(transactional.messageClass, 'TRANSACTIONAL');
assert.equal(transactional.text, ensureOptOutFooter('خدماتی', 'TRANSACTIONAL'));

const noConsentFunnel = consumeSegmentPreviewFunnel({
  total: 5,
  duplicates: 0,
  optedOut: 0,
  blacklisted: 0,
  noConsent: 5,
  invalid: 0,
  notApplicable: 0,
  final: 0,
  partsPerMsg: 1,
  totalParts: 0,
  estimatedCost: null,
  partialSources: [],
  unitPricePerPart: null,
});
assert.equal(noConsentFunnel.final, 0);
assert.equal(noConsentFunnel.noConsent, 5);
const noConsentStatus = formatRecipientPreviewStatus(noConsentFunnel);
assert.equal(noConsentStatus.tone, 'warn');
assert.match(noConsentStatus.text, /۵ مخاطب پیدا شد، اما برای پیام تبلیغاتی رضایت ثبت‌شده ندارند/);

const partial = consumeSegmentPreviewFunnel({
  final: 0,
  noConsent: 0,
  total: 0,
  partialSources: ['SALES_PARTNER'],
});
const partialStatus = formatRecipientPreviewStatus(partial);
assert.equal(partialStatus.tone, 'error');
assert.match(partialStatus.text, /SALES_PARTNER/);
assert.doesNotMatch(partialStatus.text, /^۰ گیرنده/);

const ok = formatRecipientPreviewStatus(
  consumeSegmentPreviewFunnel({
    final: 12,
    noConsent: 0,
    total: 12,
    partialSources: [],
    unitPricePerPart: null,
  }),
);
assert.equal(ok.tone, 'ok');
assert.match(ok.text, /۱۲ گیرنده نهایی/);
assert.match(ok.text, /قیمت تنظیم نشده/);

const uiSrc = readFileSync(join(__dirname, 'sms-send-ui.tsx'), 'utf8');
assert.match(uiSrc, /rules\s*=\s*\[\]/);
assert.match(uiSrc, /buildSegmentPreviewPayload\(sources,\s*previewBody,\s*messageClass,\s*parsedRules\)/);
assert.match(uiSrc, /PREVIEW_DEBOUNCE_MS/);
assert.match(uiSrc, /\[sources,\s*previewBody,\s*messageClass,\s*rulesKey\]/);
assert.doesNotMatch(
  uiSrc,
  /post<[^>]*>\('\/admin\/sms\/segments\/preview',\s*\{[^}]*rules:\s*\[\],/,
);

const wizardSrc = readFileSync(join(__dirname, 'AdminSmsWizard.tsx'), 'utf8');
assert.match(wizardSrc, /buildCitySegmentRules\(city\)/);
assert.match(wizardSrc, /rules=\{cityRules\}/);
assert.match(wizardSrc, /previewBody=\{previewBody\}/);

const settingsSrc = readFileSync(join(__dirname, 'AdminSmsRestPages.tsx'), 'utf8');
assert.match(settingsSrc, /قیمت هر پارت \(ریال\)/);
assert.match(settingsSrc, /canEditUnitPrice/);
assert.match(settingsSrc, /priceCaption/);
assert.match(settingsSrc, /parseUnitPriceInput/);

const before = buildCitySegmentRules('');
const after = buildCitySegmentRules('اصفهان');
assert.notDeepEqual(before, after);
assert.notEqual(JSON.stringify(before), JSON.stringify(after));

console.log('sms-send-ui.spec.ts: ok');

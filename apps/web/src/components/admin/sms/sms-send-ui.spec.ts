import assert from 'node:assert/strict';
import { ensureOptOutFooter } from './sms-parts.ts';
import {
  buildSegmentPreviewPayload,
  consumeSegmentPreviewFunnel,
  formatRecipientPreviewStatus,
} from './sms-send-preview.ts';

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

console.log('sms-send-ui.spec.ts: ok');

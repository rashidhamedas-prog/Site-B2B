/**
 * node --experimental-strip-types src/components/admin/sms/sms-send-ui.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureOptOutFooter } from './sms-parts.ts';
import {
  AUDIENCE_SOURCE_OPTIONS,
  CONTINUE_REASON_ID,
  PREVIEW_DEBOUNCE_MS,
  WIZARD_STEPS,
  audienceContinueGate,
  buildCitySegmentRules,
  buildPreviewPanelView,
  buildSegmentPreviewPayload,
  buildZeroRecipientReason,
  canEditUnitPrice,
  consumeSegmentPreviewFunnel,
  costCaption,
  countManualPhones,
  filterCitySuggestions,
  formatRecipientPreviewStatus,
  matchCityOption,
  mergeSegmentRules,
  normalizeFaCity,
  parseUnitPriceInput,
  previewCellText,
  priceCaption,
  sourcesNeedCityWarning,
  visualWizardStep,
} from './sms-send-preview.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

assert.deepEqual(buildCitySegmentRules(''), []);
assert.deepEqual(buildCitySegmentRules('  '), []);
assert.deepEqual(buildCitySegmentRules('تهران'), [{ field: 'city', op: 'in', value: ['تهران'] }]);
assert.deepEqual(buildCitySegmentRules('  کرج '), [{ field: 'city', op: 'in', value: ['کرج'] }]);
assert.deepEqual(buildCitySegmentRules(['تهران', 'کرج', 'تهران']), [
  { field: 'city', op: 'in', value: ['تهران', 'کرج'] },
]);
assert.deepEqual(buildCitySegmentRules(['تهران', 'كرج', 'کرج ']), [
  { field: 'city', op: 'in', value: ['تهران', 'كرج'] },
]);

assert.equal(normalizeFaCity('كرج'), normalizeFaCity('کرج '));
assert.equal(normalizeFaCity('ي'), 'ی');

assert.equal(priceCaption(null), 'قیمت تنظیم نشده');
assert.equal(priceCaption(undefined), 'قیمت تنظیم نشده');
assert.match(priceCaption(2500), /ریال/);
assert.ok(priceCaption(2500).length > 'ریال'.length);
assert.equal(costCaption(null, null), 'قیمت تنظیم نشده');
assert.equal(costCaption(100, null), 'قیمت تنظیم نشده');
assert.match(costCaption(5000, 100), /ریال/);

assert.equal(parseUnitPriceInput(''), null);
assert.equal(parseUnitPriceInput('  '), null);
assert.equal(parseUnitPriceInput('180'), 180);
assert.equal(parseUnitPriceInput('-3'), null);

assert.equal(canEditUnitPrice('ADMIN'), true);
assert.equal(canEditUnitPrice('SMS_MANAGER'), true);
assert.equal(canEditUnitPrice('SMS_MARKETER'), false);
assert.equal(canEditUnitPrice('SMS_OPERATOR'), false);

assert.equal(PREVIEW_DEBOUNCE_MS, 400);
assert.equal(countManualPhones('0912\n0913\n'), 2);
assert.equal(countManualPhones(''), 0);

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

const merged = mergeSegmentRules(buildCitySegmentRules('تهران'), [
  { field: 'orderCount', op: 'gte', value: 2 },
]);
assert.equal(merged.length, 2);
assert.equal(merged[0].field, 'city');
assert.equal(merged[1].field, 'orderCount');

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

/* ---- P0 panel states ---- */
const noSources = buildPreviewPanelView({
  sources: [],
  loading: false,
  error: null,
  funnel: null,
  previousFunnel: null,
});
assert.equal(noSources.phase, 'no-sources');
assert.match(noSources.banner || '', /هیچ منبعی/);
assert.equal(previewCellText(noSources.phase, 0, false), '—');

const calculating = buildPreviewPanelView({
  sources: ['RETAIL'],
  loading: true,
  error: null,
  funnel: null,
  previousFunnel: consumeSegmentPreviewFunnel({ final: 9, total: 10 }),
});
assert.equal(calculating.phase, 'calculating');
assert.equal(calculating.faded, true);
assert.equal(calculating.displayFunnel?.final, 9);
assert.equal(previewCellText('calculating', null, false), '…');
assert.notEqual(previewCellText('calculating', null, false), '۰');

const zeroNoConsent = buildPreviewPanelView({
  sources: ['RETAIL'],
  loading: false,
  error: null,
  funnel: noConsentFunnel,
  previousFunnel: null,
});
assert.equal(zeroNoConsent.phase, 'zero');
assert.match(zeroNoConsent.zeroReason || '', /رضایت/);
assert.match(buildZeroRecipientReason(noConsentFunnel), /رضایت/);

const errView = buildPreviewPanelView({
  sources: ['RETAIL'],
  loading: false,
  error: 'شبکه قطع است',
  funnel: null,
  previousFunnel: null,
});
assert.equal(errView.phase, 'error');
assert.equal(previewCellText('error', null, false), '—');
assert.notEqual(previewCellText('error', null, false), '۰');

const partialErr = buildPreviewPanelView({
  sources: ['RETAIL'],
  loading: false,
  error: null,
  funnel: partial,
  previousFunnel: null,
});
assert.equal(partialErr.phase, 'error');
assert.match(partialErr.banner || '', /SALES_PARTNER/);

const ready = buildPreviewPanelView({
  sources: ['RETAIL'],
  loading: false,
  error: null,
  funnel: consumeSegmentPreviewFunnel({ final: 3, total: 3, unitPricePerPart: null }),
  previousFunnel: null,
});
assert.equal(ready.phase, 'ready');

const gateCalc = audienceContinueGate({ phase: 'calculating', final: 3, manualCount: 0 });
assert.equal(gateCalc.disabled, true);
assert.ok(gateCalc.reason);

const gateZero = audienceContinueGate({ phase: 'zero', final: 0, manualCount: 0 });
assert.equal(gateZero.disabled, true);

const gateZeroManual = audienceContinueGate({ phase: 'zero', final: 0, manualCount: 2 });
assert.equal(gateZeroManual.disabled, false);

const gateErr = audienceContinueGate({ phase: 'error', final: 0, manualCount: 5 });
assert.equal(gateErr.disabled, true);

const gateNoSrc = audienceContinueGate({ phase: 'no-sources', final: 0, manualCount: 0 });
assert.equal(gateNoSrc.disabled, true);

const gateOk = audienceContinueGate({ phase: 'ready', final: 4, manualCount: 0 });
assert.equal(gateOk.disabled, false);
assert.equal(gateOk.reason, null);

assert.equal(CONTINUE_REASON_ID, 'sms-audience-continue-reason');

assert.deepEqual([...WIZARD_STEPS], ['مخاطبان', 'متن', 'زمان‌بندی', 'بازبینی و تأیید']);
assert.equal(visualWizardStep(0), 0);
assert.equal(visualWizardStep(1), 1);
assert.equal(visualWizardStep(2), 2);
assert.equal(visualWizardStep(3), 3);
assert.equal(visualWizardStep(4), 3);

assert.deepEqual(
  AUDIENCE_SOURCE_OPTIONS.map((s) => s.label),
  ['عمده', 'معرف عمده', 'همکار فروش', 'خرده‌فروشی'],
);
assert.equal(sourcesNeedCityWarning(['SALES_PARTNER']), true);
assert.equal(sourcesNeedCityWarning(['WHOLESALE']), false);

const cityOpts = [
  { value: 'کرج', count: 10 },
  { value: 'تهران', count: 20 },
];
assert.equal(matchCityOption(cityOpts, 'كرج'), 'کرج');
assert.equal(matchCityOption(cityOpts, 'شیراز'), null);
assert.equal(filterCitySuggestions(cityOpts, 'ته').length, 1);

const uiSrc = readFileSync(join(__dirname, 'sms-send-ui.tsx'), 'utf8');
assert.match(uiSrc, /rules\s*=\s*\[\]/);
assert.match(uiSrc, /buildSegmentPreviewPayload\(sources,\s*previewBody,\s*messageClass,\s*parsedRules\)/);
assert.match(uiSrc, /PREVIEW_DEBOUNCE_MS/);
assert.match(uiSrc, /AbortController/);
assert.match(uiSrc, /aria-live="polite"/);
assert.match(uiSrc, /aria-atomic="true"/);
assert.match(uiSrc, /role="status"/);
assert.match(uiSrc, /منبع مخاطبان/);
assert.match(uiSrc, /تکراری‌ها یک‌بار ارسال می‌شوند/);
assert.match(uiSrc, /شماره‌های دستی، یک شماره در هر خط/);
assert.match(uiSrc, /انتخاب فایل/);
assert.match(uiSrc, /فایلی انتخاب نشده/);
assert.match(uiSrc, /این شماره‌ها هم از لغو\/سیاه و رضایت عبور می‌کنند/);
assert.match(uiSrc, /شماره‌های دستی/);
assert.match(uiSrc, /به‌زودی/);
assert.match(uiSrc, /aria-disabled/);
assert.match(uiSrc, /CONTINUE_REASON_ID/);
assert.match(uiSrc, /بعدی: متن پیام/);
assert.match(uiSrc, /\/admin\/sms\/audience\/sources/);
assert.match(uiSrc, /\/admin\/sms\/audience\/fields/);
assert.match(uiSrc, /\/admin\/sms\/segments/);
assert.doesNotMatch(uiSrc, /placeholder="0912/);

const wizardSrc = readFileSync(join(__dirname, 'AdminSmsWizard.tsx'), 'utf8');
assert.match(wizardSrc, /buildCitySegmentRules\(cities\)/);
assert.match(wizardSrc, /rules=\{allRules\}/);
assert.match(wizardSrc, /previewBody=\{previewBody\}/);
assert.match(wizardSrc, /aria-label="مراحل ارسال انبوه"/);
assert.match(wizardSrc, /ارسال انبوه — مخاطبان/);
assert.match(wizardSrc, /WIZARD_STEPS/);
assert.match(wizardSrc, /visualWizardStep/);
assert.match(wizardSrc, /ManualNumbersField/);
assert.match(wizardSrc, /AudienceContinueButton/);
assert.doesNotMatch(wizardSrc, /const STEPS = \['مخاطب'/);

const dashSrc = readFileSync(join(__dirname, 'AdminSmsDashboard.tsx'), 'utf8');
assert.match(dashSrc, /معرف عمده/);
assert.match(dashSrc, /خرده‌فروشی/);

const restSrc = readFileSync(join(__dirname, 'AdminSmsRestPages.tsx'), 'utf8');
assert.match(restSrc, /معرف عمده/);
assert.match(restSrc, /خرده‌فروشی/);
assert.match(restSrc, /قیمت هر پارت \(ریال\)/);
assert.match(restSrc, /canEditUnitPrice/);
assert.match(restSrc, /priceCaption/);
assert.match(restSrc, /parseUnitPriceInput/);

const cssSrc = readFileSync(join(__dirname, 'sms-wizard.css'), 'utf8');
assert.match(cssSrc, /sms-sticky/);
assert.match(cssSrc, /sms-bottombar/);
assert.match(cssSrc, /2fr 1fr/);
assert.match(cssSrc, /min-height:\s*44px/);

const previewService = readFileSync(
  join(__dirname, '../../../../../api/src/modules/sms-panel/sms-panel.service.ts'),
  'utf8',
);
assert.match(previewService, /isBlacklisted/);
assert.match(previewService, /suppressions/);
assert.match(previewService, /hasPromoConsent/);
assert.match(previewService, /async previewCampaign/);

const before = buildCitySegmentRules('');
const after = buildCitySegmentRules('اصفهان');
assert.notDeepEqual(before, after);
assert.notEqual(JSON.stringify(before), JSON.stringify(after));

console.log('sms-send-ui.spec.ts: ok');

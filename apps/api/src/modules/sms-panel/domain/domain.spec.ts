import * as assert from 'node:assert/strict';
import { normalizeIranMobileStrict, maskMobile, isValidIranMobile } from './phone';
import { countSmsParts, estimatePartsCost } from './parts';
import { fillTemplateStrict, ensureOptOutFooter, hasOptOutFooter } from './template';
import {
  isWithinPromoWindow,
  nextPromoWindowOpen,
  DEFAULT_PROMO_WINDOW,
} from './quiet-hours';
import { parseInboundIntent } from './inbound';
import { backoffDelayMs, SMS_RETRY_MAX_ATTEMPTS } from './backoff';

// --- phone ---
assert.strictEqual(normalizeIranMobileStrict('09121234567'), '09121234567');
assert.strictEqual(normalizeIranMobileStrict('۹۱۲۱۲۳۴۵۶۷'), '09121234567');
assert.strictEqual(normalizeIranMobileStrict('+989121234567'), '09121234567');
assert.strictEqual(normalizeIranMobileStrict('00989121234567'), '09121234567');
assert.strictEqual(normalizeIranMobileStrict('98123'), null);
assert.ok(isValidIranMobile('09121234567'));
assert.strictEqual(maskMobile('09121234567'), '0912***4567');

// --- parts ---
assert.strictEqual(countSmsParts('ا'.repeat(70)), 1);
assert.strictEqual(countSmsParts('ا'.repeat(71)), 2);
assert.strictEqual(countSmsParts('x'.repeat(67 * 2)), 2);
assert.strictEqual(estimatePartsCost(['ا'.repeat(70), 'ا'.repeat(71)]), 3);

// --- template ---
assert.strictEqual(fillTemplateStrict('سلام {name}', { name: 'علی' }), 'سلام علی');
assert.throws(() => fillTemplateStrict('سلام {name}', {}), /MISSING/);
assert.throws(() => fillTemplateStrict('سلام {x}', { x: '1' }, ['name']), /UNKNOWN/);
assert.ok(hasOptOutFooter('متن\nلغو11'));
assert.ok(ensureOptOutFooter('تبلیغ', 'PROMO').endsWith('لغو11'));
assert.ok(ensureOptOutFooter('خدماتی\nلغو11', 'TRANSACTIONAL').endsWith('لغو11'));
assert.strictEqual(ensureOptOutFooter('کد {code}', 'OTP'), 'کد {code}');

// --- quiet hours (fixed UTC instants → Tehran) ---
// 2026-10-26 04:30 UTC = 08:00 Tehran (UTC+3:30)
const openAt = new Date('2026-10-26T04:30:00.000Z');
assert.ok(isWithinPromoWindow(openAt, DEFAULT_PROMO_WINDOW), '08:00 open');
const before = new Date('2026-10-26T04:29:00.000Z'); // 07:59 Tehran
assert.ok(!isWithinPromoWindow(before, DEFAULT_PROMO_WINDOW), '07:59 closed');
const almostEnd = new Date('2026-10-26T17:29:00.000Z'); // 20:59 Tehran
assert.ok(isWithinPromoWindow(almostEnd, DEFAULT_PROMO_WINDOW), '20:59 open');
const atEnd = new Date('2026-10-26T17:30:00.000Z'); // 21:00 Tehran
assert.ok(!isWithinPromoWindow(atEnd, DEFAULT_PROMO_WINDOW), '21:00 closed');
const custom = { start: '10:00', end: '12:00' };
assert.ok(!isWithinPromoWindow(openAt, custom), 'custom closed at 08');
const next = nextPromoWindowOpen(before, DEFAULT_PROMO_WINDOW);
assert.ok(next && next.getTime() > before.getTime(), 'next window');

// --- inbound ---
assert.strictEqual(parseInboundIntent('11'), 'UNSUBSCRIBE_11');
assert.strictEqual(parseInboundIntent('۱۱'), 'UNSUBSCRIBE_11');
assert.strictEqual(parseInboundIntent('لغو11'), 'UNSUBSCRIBE_11');
assert.strictEqual(parseInboundIntent('لغو ۱۱'), 'UNSUBSCRIBE_11');
assert.strictEqual(parseInboundIntent('12'), 'RESUBSCRIBE_12');
assert.strictEqual(parseInboundIntent('سلام'), 'UNKNOWN');

// --- backoff ---
const d0 = backoffDelayMs(0, { random: () => 0.5 }); // no jitter
assert.strictEqual(d0, 30_000);
const d1 = backoffDelayMs(1, { random: () => 0.5 });
assert.strictEqual(d1, 60_000);
const dBig = backoffDelayMs(10, { random: () => 0.5 });
assert.strictEqual(dBig, 15 * 60_000);
assert.strictEqual(SMS_RETRY_MAX_ATTEMPTS, 5);

console.log('sms-panel domain: OK');

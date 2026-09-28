/**
 * Pure unit checks for the shared SMS cooldown HTTP contract (no Nest bootstrap).
 * Prefer: npx ts-node --transpile-only src/modules/notification/sms-cooldown-http.spec.ts
 */
import * as assert from 'node:assert/strict';
import { HttpStatus } from '@nestjs/common';
import {
  applyRetryAfter,
  SMS_COOLDOWN_MESSAGE,
  SmsCooldownException,
  smsCooldownPayload,
} from './sms-cooldown-http';
import { OtpCooldownError } from '../redis/redis.module';

const payload = smsCooldownPayload(17, 60);
assert.equal(payload.remainingSeconds, 17);
assert.equal(payload.cooldownSeconds, 60);
assert.equal(payload.code, 'SMS_COOLDOWN');
assert.equal(payload.message, SMS_COOLDOWN_MESSAGE);
assert.equal(smsCooldownPayload(1, 60, 'ارسال دوباره هنوز ممکن نیست').message, 'ارسال دوباره هنوز ممکن نیست');

// Express-style reply
const expressHeaders: Record<string, string> = {};
applyRetryAfter({ setHeader: (n, v) => { expressHeaders[n] = v; } }, 12.2);
assert.equal(expressHeaders['Retry-After'], '13', 'Retry-After rounds up');

// Fastify-style reply
const fastifyHeaders: Record<string, string> = {};
applyRetryAfter({ header: (n, v) => { fastifyHeaders[n] = v; } }, 0);
assert.equal(fastifyHeaders['Retry-After'], '1', 'Retry-After is never below 1');

const exception = new SmsCooldownException(42, 60);
assert.equal(exception.getStatus(), HttpStatus.TOO_MANY_REQUESTS);
assert.equal(exception.remainingSeconds, 42);
assert.deepEqual(exception.getResponse(), smsCooldownPayload(42, 60));

const cooldownError = new OtpCooldownError(31);
assert.equal(cooldownError.remainingSeconds, 31);
assert.equal(cooldownError.message, 'COOLDOWN', 'message stays COOLDOWN for legacy callers');
assert.ok(cooldownError instanceof Error);

console.log('sms-cooldown-http.spec.ts: OK');

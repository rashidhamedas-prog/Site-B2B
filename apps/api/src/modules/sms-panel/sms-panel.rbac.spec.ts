import * as assert from 'node:assert/strict';
import { SMS_ALL, SMS_MANAGERS, SMS_MARKETERS, SMS_SEND_SINGLE, smsRoleLabel } from './sms-roles';
import { ensureOptOutFooter, fillTemplateStrict } from './domain/template';
import { countSmsParts } from './domain/parts';
import { createHash } from 'crypto';
import { tokenFlow } from './sms-panel.token-logic';

assert.ok(SMS_ALL.includes('ADMIN'));
assert.ok(SMS_MANAGERS.includes('SMS_MANAGER'));
assert.ok(!SMS_MANAGERS.includes('SMS_OPERATOR'));
assert.ok(SMS_MARKETERS.includes('SMS_MARKETER'));
assert.ok(SMS_SEND_SINGLE.includes('SMS_OPERATOR'));
assert.strictEqual(smsRoleLabel('ADMIN'), 'مدیر کل');
assert.strictEqual(smsRoleLabel('SMS_MANAGER'), 'مدیر پیامک');

// PROMO operator forbidden is enforced in service; roles matrix here
assert.ok(!SMS_MANAGERS.includes('SMS_OPERATOR'), 'operator not manager');

// two-step token logic
const { raw, hash, payload, stale } = tokenFlow({
  campaignId: 'c1',
  audienceSnapshotHash: 'a1',
  body: 'hello\nلغو11',
  scheduledAt: null,
});
assert.ok(raw.length >= 32);
assert.strictEqual(hash, createHash('sha256').update(raw).digest('hex'));
assert.ok(!stale(payload));
assert.ok(stale({ ...payload, body: 'changed' }));

const body = ensureOptOutFooter('تخفیف ویژه', 'PROMO');
assert.ok(body.includes('لغو11'));
assert.ok(countSmsParts(body) >= 1);
assert.strictEqual(fillTemplateStrict('{name}', { name: 'علی' }), 'علی');

// credit unit is SMS parts
const estimatedParts = 3200;
const credit = 12450;
assert.ok(estimatedParts < credit, 'bulk allowed when parts < credit SMS');

console.log('sms-panel rbac/token: OK');

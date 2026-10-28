import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { STAFF_ROLE_LABELS } from '../auth/staff-access';
import { canEditUnitPrice, decideSingleSend } from './audience/send-audience';
import { SmsPanelController } from './sms-panel.controller';
import {
  audienceLookupRetryAfter,
  checkSendSingleAllowed,
  roleAllowsSmsRoute,
  settingsAuditSnapshot,
  SMS_ROUTE_ROLES,
  type SmsRouteName,
} from './sms-panel.policy';
import { SMS_ROLES_KEY } from './sms-roles';

const proto = SmsPanelController.prototype as unknown as Record<string, unknown>;
const routeNames = Object.keys(SMS_ROUTE_ROLES) as SmsRouteName[];

for (const name of routeNames) {
  const handler = proto[name];
  assert.equal(typeof handler, 'function', `${name} missing`);
  assert.notEqual(Reflect.getMetadata(METHOD_METADATA, handler), undefined, `${name} is not a route`);
  const roles = Reflect.getMetadata(SMS_ROLES_KEY, handler) as string[] | undefined;
  assert.ok(roles?.length, `${name} has no @SmsRoles`);
  assert.deepEqual([...roles].sort(), [...SMS_ROUTE_ROLES[name]].sort(), name);
}

for (const name of Object.getOwnPropertyNames(proto)) {
  const handler = proto[name];
  if (typeof handler !== 'function') continue;
  if (Reflect.getMetadata(METHOD_METADATA, handler) == null) continue;
  assert.ok(name in SMS_ROUTE_ROLES, `route ${name} is missing from the policy matrix`);
}

const roles = ['ADMIN', 'SMS_MANAGER', 'SMS_OPERATOR', 'SMS_MARKETER'] as const;
for (const role of roles) {
  assert.equal(roleAllowsSmsRoute(role, 'send'), true, role);
  assert.equal(roleAllowsSmsRoute(role, 'audienceContacts'), true, role);
}
assert.equal(roleAllowsSmsRoute('SMS_MARKETER', 'approve'), false);
assert.equal(roleAllowsSmsRoute('SMS_OPERATOR', 'approve'), false);
assert.equal(roleAllowsSmsRoute('SMS_OPERATOR', 'segmentCreate'), false);
assert.equal(roleAllowsSmsRoute('SMS_OPERATOR', 'segmentUpdate'), false);
assert.equal(roleAllowsSmsRoute('SMS_OPERATOR', 'segmentDelete'), false);
assert.equal(roleAllowsSmsRoute('SMS_MARKETER', 'patchSettings'), false);
assert.equal(roleAllowsSmsRoute('SMS_MARKETER', 'segmentCreate'), true);
assert.equal(roleAllowsSmsRoute('SALES_REP', 'send'), false);
assert.equal(roleAllowsSmsRoute('', 'credit'), false);

assert.equal(checkSendSingleAllowed('SMS_MARKETER', 'TRANSACTIONAL')?.code, 'SMS_FORBIDDEN');
assert.equal(checkSendSingleAllowed('SMS_OPERATOR', 'PROMO')?.code, 'SMS_FORBIDDEN');
assert.equal(checkSendSingleAllowed('SMS_OPERATOR', 'TRANSACTIONAL', { templateId: 't' }), null);
assert.equal(canEditUnitPrice('SMS_MARKETER'), false);
assert.equal(canEditUnitPrice('SMS_OPERATOR'), false);
assert.equal(canEditUnitPrice('ADMIN'), true);
assert.equal(canEditUnitPrice('SMS_MANAGER'), true);

for (const role of ['SMS_OPERATOR', 'SMS_MARKETER'] as const) {
  const offlist = decideSingleSend({
    role,
    messageClass: role === 'SMS_MARKETER' ? 'PROMO' : 'TRANSACTIONAL',
    contact: null,
    withinWindow: true,
  });
  assert.equal(offlist.ok, false);
  if (!offlist.ok) assert.equal(offlist.code, 'SMS_OFFLIST_FORBIDDEN');
}

assert.equal(audienceLookupRetryAfter(30), null);
assert.equal(audienceLookupRetryAfter(31), 60);

const snap = settingsAuditSnapshot({
  promoWindowStart: '08:00',
  promoWindowEnd: '21:00',
  promoPerDay: 1,
  promoPerWeek: 3,
  creditWarnThreshold: 500,
  testNumbers: ['09120000000'],
  otpCooldownSeconds: 60,
  unitPricePerPart: null,
});
assert.equal(JSON.stringify(snap).includes('09120000000'), false);
assert.equal(snap.testNumberCount, 1);

assert.equal(STAFF_ROLE_LABELS.ADMIN, 'مدیر کل');
assert.equal(STAFF_ROLE_LABELS.SMS_MANAGER, 'مدیر پیامک');
assert.equal(STAFF_ROLE_LABELS.SMS_OPERATOR, 'اپراتور');
assert.equal(STAFF_ROLE_LABELS.SMS_MARKETER, 'بازاریاب');

console.log('sms-panel.rbac-matrix.spec.ts: ok');

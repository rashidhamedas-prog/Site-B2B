import assert from 'node:assert/strict';
import { smsNavForRole } from './sms-nav.ts';

const hrefs = (role: string) => smsNavForRole(role).map((link) => link.href);

assert.ok(hrefs('ADMIN').includes('/admin/sms/settings'));
assert.ok(hrefs('SMS_MANAGER').includes('/admin/sms/optout'));
assert.equal(hrefs('SMS_OPERATOR').includes('/admin/sms/settings'), false);
assert.equal(hrefs('SMS_OPERATOR').includes('/admin/sms/campaigns/new'), false);
assert.ok(hrefs('SMS_OPERATOR').includes('/admin/sms/send'));
assert.ok(hrefs('SMS_MARKETER').includes('/admin/sms/campaigns/new'));
assert.equal(hrefs('SMS_MARKETER').includes('/admin/sms/settings'), false);
assert.equal(hrefs('SALES_REP').length, 0);

console.log('sms-nav.spec.ts: ok');

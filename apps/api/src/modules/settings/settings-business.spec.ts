/**
 * npx ts-node --transpile-only src/modules/settings/settings-business.spec.ts
 */
import * as assert from 'node:assert/strict';
import { normalizeBusinessPostal, normalizeBusinessSettings } from './settings-business';

assert.equal(normalizeBusinessPostal('۹۱۸۷۱۵۴۳۲۱'), '9187154321');
assert.equal(normalizeBusinessPostal('9187154321 extra'), '9187154321');
assert.equal(normalizeBusinessPostal('09152424624'), '');
assert.equal(normalizeBusinessPostal(''), '');
assert.equal(normalizeBusinessPostal(null), '');

const next = normalizeBusinessSettings({
  postalCode: '۹۱۸۷۱۵۴۳۲۱',
  logoUrl: 'javascript:alert(1)',
  logoAlt: '<b>لوگو</b>',
});
assert.equal(next.postalCode, '9187154321');
assert.equal(next.logoUrl, '');
assert.equal(next.logoAlt, 'لوگو');

console.log('settings-business.spec ok');

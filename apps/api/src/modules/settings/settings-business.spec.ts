/**
 * npx ts-node --transpile-only src/modules/settings/settings-business.spec.ts
 */
import * as assert from 'node:assert/strict';
import { normalizeBusinessPostal } from './settings-business';

assert.equal(normalizeBusinessPostal('۹۱۸۷۱۵۴۳۲۱'), '9187154321');
assert.equal(normalizeBusinessPostal('9187154321 extra'), '9187154321');
assert.equal(normalizeBusinessPostal('09152424624'), '');
assert.equal(normalizeBusinessPostal(''), '');
assert.equal(normalizeBusinessPostal(null), '');

console.log('settings-business.spec ok');

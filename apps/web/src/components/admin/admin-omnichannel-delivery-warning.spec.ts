/**
 * npx tsx apps/web/src/components/admin/admin-omnichannel-delivery-warning.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeliveryPhotoWarning } from './admin-omnichannel-delivery-warning';

assert.equal(isDeliveryPhotoWarning(null), false);
assert.equal(isDeliveryPhotoWarning(undefined), false);
assert.equal(isDeliveryPhotoWarning(''), false);
assert.equal(isDeliveryPhotoWarning('  '), false);
assert.equal(isDeliveryPhotoWarning('unsupported_media'), false);
assert.equal(isDeliveryPhotoWarning('network_error'), false);
assert.equal(isDeliveryPhotoWarning('warnings:'), true);
assert.equal(isDeliveryPhotoWarning('warnings:photo_1_failed'), true);
assert.equal(isDeliveryPhotoWarning('Warnings:photo_1_failed'), true);
assert.equal(isDeliveryPhotoWarning('  warnings:skip  '), true);
assert.equal(isDeliveryPhotoWarning('prefix warnings:nope'), false);

const admin = readFileSync(join(__dirname, 'AdminOmnichannel.tsx'), 'utf8');
assert.match(admin, /isDeliveryPhotoWarning/);
assert.match(admin, /هشدار/);
assert.match(admin, /text-amber-700/);
assert.match(admin, /row\.status === 'SUCCEEDED' && isDeliveryPhotoWarning/);
assert.doesNotMatch(
  admin,
  /photoWarning[\s\S]{0,120}(failureCount|failedDeliveries)/,
  'warning styling must not touch failure counters',
);

console.log('admin-omnichannel-delivery-warning.spec.ts OK');

/**
 * npx tsx apps/web/src/components/admin/admin-omnichannel-delivery-warning.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deliveryWarningLabel,
  isDeliveryPhotoWarning,
  isNonRetryableDeliveryError,
} from './admin-omnichannel-delivery-warning';

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

assert.equal(deliveryWarningLabel('warnings:'), 'موفق با هشدار رسانه');
assert.match(deliveryWarningLabel('warnings:photo_1_failed'), /عکس/);
assert.match(deliveryWarningLabel('warnings:photo_skipped:x:y'), /عکس/);

assert.equal(isNonRetryableDeliveryError(null), false);
assert.equal(isNonRetryableDeliveryError('timeout'), false);
assert.equal(isNonRetryableDeliveryError('unsupported_media'), true);
assert.equal(isNonRetryableDeliveryError('Bad Request: UNSUPPORTED_FILE'), true);
assert.equal(isNonRetryableDeliveryError('file too large'), true);

const here = dirname(fileURLToPath(import.meta.url));
const admin = readFileSync(join(here, 'AdminOmnichannel.tsx'), 'utf8');
assert.match(admin, /isDeliveryPhotoWarning/);
assert.match(admin, /deliveryWarningLabel/);
assert.match(admin, /isNonRetryableDeliveryError/);
assert.match(admin, /موفق با هشدار/);
assert.match(admin, /اول تصویر را اصلاح کنید/);
assert.match(admin, /text-amber-700/);
assert.match(admin, /row\.status === 'SUCCEEDED' && isDeliveryPhotoWarning/);
assert.doesNotMatch(
  admin,
  /failingReal.*isDeliveryPhotoWarning|isDeliveryPhotoWarning.*failingReal/,
  'warning styling must not touch failure counters',
);

const ui = readFileSync(join(here, 'admin-omnichannel-ui.tsx'), 'utf8');
assert.match(ui, /unsupported_media:/);

console.log('admin-omnichannel-delivery-warning.spec.ts OK');

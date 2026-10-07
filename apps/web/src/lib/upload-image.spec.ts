/**
 * npx tsx src/lib/upload-image.spec.ts
 */
import assert from 'node:assert/strict';
import {
  clientUploadImageRejection,
  MAX_UPLOAD_IMAGE_BYTES,
  UPLOAD_FETCH_TIMEOUT_MS,
  UPLOAD_TIMEOUT_MESSAGE,
} from './upload-image.ts';

assert.equal(clientUploadImageRejection({ name: 'a.jpg', type: 'image/jpeg', size: 100 }), null);
assert.equal(clientUploadImageRejection({ name: 'blob', type: 'image/png', size: 100 }), null);
assert.match(clientUploadImageRejection({ name: 'a.heic', type: '', size: 100 }) || '', /HEIC/);
assert.match(
  clientUploadImageRejection({ name: 'a.jpg', type: 'image/jpeg', size: MAX_UPLOAD_IMAGE_BYTES + 1 }) || '',
  /۲۰ مگابایت/,
);

assert.equal(UPLOAD_FETCH_TIMEOUT_MS, 120_000);
assert.match(UPLOAD_TIMEOUT_MESSAGE, /آپلود/);

console.log('upload-image.spec.ts: ok');

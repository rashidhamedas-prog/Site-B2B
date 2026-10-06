import * as assert from 'node:assert/strict';
import { MAX_UPLOAD_IMAGE_BYTES, uploadImageKind, uploadImageRejection } from './upload-image-policy';

assert.equal(uploadImageKind('look.JPG', ''), 'jpg');
assert.equal(uploadImageKind('camera.jfif', 'image/jpeg'), 'jpg');
assert.equal(uploadImageKind('blob', 'image/jpeg'), 'jpg');
assert.equal(uploadImageKind('shot.png', 'application/octet-stream'), 'png');
assert.equal(uploadImageRejection('look.jpg', 'image/jpeg', 1200), null);
assert.equal(uploadImageRejection('blob', 'image/webp', 0), null);
assert.match(uploadImageRejection('IMG.HEIC', '', 10) || '', /HEIC/);
assert.match(uploadImageRejection('a.heif', 'image/heif', 10) || '', /HEIC/);
assert.match(uploadImageRejection('notes.txt', 'text/plain', 10) || '', /مجاز نیست/);
assert.match(uploadImageRejection('big.jpg', 'image/jpeg', MAX_UPLOAD_IMAGE_BYTES + 1) || '', /۲۰ مگابایت/);
assert.equal(uploadImageRejection('big.jpg', 'image/jpeg', 0), null);

console.log('upload-image-policy.spec.ts: ok');

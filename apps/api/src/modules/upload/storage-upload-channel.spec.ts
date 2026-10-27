/**
 * npx ts-node --transpile-only src/modules/upload/storage-upload-channel.spec.ts
 */
import * as assert from 'node:assert/strict';
import { CHANNEL_PHOTO_MAX_BYTES, prepareChannelJpeg } from './channel-image';
import {
  CHANNEL_JPEG_SUFFIX,
  channelDerivativeKey,
  keepOriginalUploads,
  originalUploadKey,
  relatedObjectKeys,
} from './storage-delete';

function assertFn(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const mainKey = 'products/demo.webp';
  const channelKey = channelDerivativeKey(mainKey);
  assertFn(channelKey === `products/demo.webp${CHANNEL_JPEG_SUFFIX}`, 'channel derivative suffix');
  assertFn(originalUploadKey(mainKey) === 'originals/products/demo.webp', 'original upload key');

  const related = relatedObjectKeys(mainKey);
  assertFn(related.length === 3, 'related keys include main + channel + original');
  assertFn(related[0] === mainKey && related.includes(channelKey!) && related.includes('originals/products/demo.webp'), 'related set');

  assertFn(keepOriginalUploads({}) === false, 'KEEP_ORIGINAL_UPLOADS unset');
  assertFn(keepOriginalUploads({ KEEP_ORIGINAL_UPLOADS: 'true' }) === true, 'KEEP_ORIGINAL_UPLOADS=true');

  const sharp = require('sharp');
  const webp = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 40, g: 90, b: 120 } },
  })
    .webp()
    .toBuffer();
  const channel = await prepareChannelJpeg(webp, {
    maxBytes: CHANNEL_PHOTO_MAX_BYTES,
    longEdge: 1600,
    minQuality: 55,
  });
  assertFn(channel.bytes.length <= CHANNEL_PHOTO_MAX_BYTES, 'upload pipeline target size matches channel cap');
  assert.equal(channel.contentType, 'image/jpeg');

  console.log('storage-upload-channel.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

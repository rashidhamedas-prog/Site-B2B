/**
 * npx ts-node --transpile-only src/modules/omnichannel/media-validation.spec.ts
 */
import * as assert from 'node:assert/strict';
import { CHANNEL_PHOTO_MAX_BYTES } from '../upload/channel-image';
import type { SharpFactory } from '../upload/image-processor';
import {
  assertChannelPhotoReady,
  channelPhotoMaxBytes,
  isTruncatedJpeg,
  MEDIA_MESSAGE_FA,
  validateImageBuffer,
} from './media-validation';

const FIVE_MIB = 5 * 1024 * 1024;

async function main() {
  assert.equal(channelPhotoMaxBytes(), CHANNEL_PHOTO_MAX_BYTES, 'reuses CHANNEL_PHOTO_MAX_BYTES (C5)');
  assert.equal(CHANNEL_PHOTO_MAX_BYTES, Math.floor(1.8 * 1024 * 1024), '1.8 MiB gate');

  // 5047-class: 5 MiB JPEG SOI without EOI
  const cut = Buffer.alloc(FIVE_MIB);
  cut[0] = 0xff;
  cut[1] = 0xd8;
  cut[2] = 0xff;
  assert.equal(isTruncatedJpeg(cut), true, '5047-class truncated');
  const rejected = await validateImageBuffer(cut);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, 'truncated');
  assert.match(rejected.messageFa, /JPEG ناقص|اصلاح/);
  await assert.rejects(
    () => assertChannelPhotoReady(cut),
    (err: unknown) =>
      err instanceof Error && err.message.startsWith('unsupported_media'),
    'assert → unsupported_media',
  );

  const sharp = ((require('sharp') as any).default ?? require('sharp')) as SharpFactory;
  const jpeg = await sharp({
    create: { width: 48, height: 32, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .jpeg()
    .toBuffer();
  const ok = await validateImageBuffer(jpeg);
  assert.equal(ok.ok, true, 'valid small JPEG');
  assert.equal(ok.width, 48);
  assert.ok(ok.bytes > 0);
  await assertChannelPhotoReady(jpeg);

  // Oversized after decode: noisy PNG (not JPEG — EOI check skipped) over channel max
  const raw = Buffer.alloc(2200 * 2200 * 3);
  for (let i = 0; i < raw.length; i += 1) raw[i] = (i * 17) & 0xff;
  const big = await sharp(raw, { raw: { width: 2200, height: 2200, channels: 3 } })
    .png({ compressionLevel: 0 })
    .toBuffer();
  assert.ok(big.length > CHANNEL_PHOTO_MAX_BYTES, 'fixture exceeds 1.8 MiB');
  const over = await validateImageBuffer(big);
  assert.equal(over.ok, false, 'oversized decode path');
  assert.equal(over.code, 'oversized');
  assert.match(over.messageFa, /بزرگ|اصلاح/);

  const empty = await validateImageBuffer(Buffer.alloc(0));
  assert.equal(empty.code, 'undecodable');

  assert.match(MEDIA_MESSAGE_FA.unsupported_media, /^unsupported_media:/);
  assert.ok(!/token|secret|vault/i.test(JSON.stringify(MEDIA_MESSAGE_FA)), 'no secrets in messages');

  console.log('media-validation.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

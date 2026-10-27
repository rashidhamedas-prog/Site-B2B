/**
 * npx ts-node --transpile-only src/modules/upload/channel-image.spec.ts
 */
import * as assert from 'node:assert/strict';
import {
  CHANNEL_PHOTO_MAX_BYTES,
  channelEdgeSteps,
  isCompleteJpeg,
  prepareChannelJpeg,
} from './channel-image';

function assertFn(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  assertFn(channelEdgeSteps(1600)[0] === 1600, 'edge ladder starts at requested long edge');
  assertFn(isCompleteJpeg(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9])) === true, 'minimal JPEG EOI');
  assertFn(isCompleteJpeg(Buffer.from([0xff, 0xd8, 0xff, 0x00])) === false, 'truncated JPEG rejected');

  await assert.rejects(
    () => prepareChannelJpeg(Buffer.from([1, 2, 3, 4, 5]), { maxBytes: CHANNEL_PHOTO_MAX_BYTES, longEdge: 1600 }),
    (err: unknown) => err instanceof Error && err.message === 'photo_unreadable',
    'random bytes → photo_unreadable',
  );

  const sharp = require('sharp');

  const noisyPng = await sharp({
    create: {
      width: 4000,
      height: 4000,
      channels: 3,
      noise: { type: 'gaussian', mean: 128, sigma: 60 },
    },
  })
    .png()
    .toBuffer();
  const fromNoisy = await prepareChannelJpeg(noisyPng, { maxBytes: CHANNEL_PHOTO_MAX_BYTES, longEdge: 1600, minQuality: 55 });
  assertFn(fromNoisy.bytes.length <= CHANNEL_PHOTO_MAX_BYTES, 'noisy 4000 PNG fits under 1.8MB');
  assertFn(isCompleteJpeg(fromNoisy.bytes), 'noisy PNG → complete JPEG');
  const noisyMeta = await sharp(fromNoisy.bytes).metadata();
  assertFn((noisyMeta.width ?? 0) > 0 && (noisyMeta.height ?? 0) > 0, 'noisy JPEG decodes');

  const alpha = await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.5 } },
  })
    .png()
    .toBuffer();
  const flattened = await prepareChannelJpeg(alpha, { maxBytes: CHANNEL_PHOTO_MAX_BYTES, longEdge: 1600 });
  const meta = await sharp(flattened.bytes).metadata();
  assertFn(meta.hasAlpha !== true, 'alpha PNG is flattened to opaque JPEG');

  const webp = await sharp({
    create: { width: 128, height: 96, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .webp()
    .toBuffer();
  const fromWebp = await prepareChannelJpeg(webp, { maxBytes: CHANNEL_PHOTO_MAX_BYTES, longEdge: 1600 });
  assertFn(fromWebp.contentType === 'image/jpeg' && isCompleteJpeg(fromWebp.bytes), 'webp → jpeg');

  const cutJpeg = Buffer.alloc(200);
  cutJpeg[0] = 0xff;
  cutJpeg[1] = 0xd8;
  cutJpeg[2] = 0xff;
  await assert.rejects(
    () => prepareChannelJpeg(cutJpeg, { maxBytes: CHANNEL_PHOTO_MAX_BYTES, longEdge: 1600 }),
    (err: unknown) => err instanceof Error && err.message === 'photo_unreadable',
    'truncated JPEG input rejected',
  );

  console.log('channel-image.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

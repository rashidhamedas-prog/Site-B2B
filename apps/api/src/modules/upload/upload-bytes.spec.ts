/**
 * npx ts-node --transpile-only src/modules/upload/upload-bytes.spec.ts
 */
import * as assert from 'node:assert/strict';
import { ProductImageProcessingError } from './image-processor';
import {
  assertDecodableImage,
  confirmStoredImage,
  jpegEndsWithEoi,
  readUploadFile,
  rejectTruncatedJpeg,
  UploadTooLargeError,
  type UploadByteStream,
} from './upload-bytes';

const FIVE_MIB = 5 * 1024 * 1024;

function streamFrom(chunks: Buffer[], truncated = false): UploadByteStream {
  const iterable = (async function* () {
    for (const chunk of chunks) yield chunk;
  })();
  return Object.assign(iterable, { truncated });
}

async function main() {
  assert.equal(FIVE_MIB, 5_242_880, '5 MiB is the historical cap');

  const exact = await readUploadFile(streamFrom([Buffer.alloc(FIVE_MIB, 1)]), FIVE_MIB);
  assert.equal(exact.length, FIVE_MIB, 'a file that is exactly the cap is kept');

  await assert.rejects(
    () => readUploadFile(streamFrom([Buffer.alloc(FIVE_MIB, 1)], true), FIVE_MIB),
    (err: unknown) => err instanceof UploadTooLargeError,
    'truncated flag at exactly 5 MiB is rejected, not stored',
  );

  await assert.rejects(
    () => readUploadFile(streamFrom([Buffer.alloc(FIVE_MIB, 1), Buffer.from([2])]), FIVE_MIB),
    (err: unknown) => err instanceof UploadTooLargeError,
    'one byte over the cap is rejected',
  );

  const cut = Buffer.alloc(FIVE_MIB);
  cut[0] = 0xff;
  cut[1] = 0xd8;
  cut[2] = 0xff;
  assert.equal(jpegEndsWithEoi(cut), false, '5 MiB JPEG without EOI');
  await assert.rejects(
    () => assertDecodableImage(cut),
    (err: unknown) => err instanceof ProductImageProcessingError && /EOI/.test(String((err as ProductImageProcessingError).cause)),
    'cut JPEG fails the integrity check',
  );
  assert.throws(() => rejectTruncatedJpeg(cut), ProductImageProcessingError);

  const sharp = ((require('sharp') as any).default ?? require('sharp')) as (...args: any[]) => any;
  const jpeg = await sharp({
    create: { width: 32, height: 24, channels: 3, background: { r: 20, g: 40, b: 60 } },
  })
    .jpeg()
    .toBuffer();
  assert.equal(jpegEndsWithEoi(jpeg), true);
  const meta = await assertDecodableImage(jpeg);
  assert.equal(meta.format, 'jpeg');
  assert.equal(meta.width, 32);

  const sliced = jpeg.subarray(0, jpeg.length - 2);
  assert.equal(jpegEndsWithEoi(sliced), false);
  await assert.rejects(() => assertDecodableImage(sliced), ProductImageProcessingError);

  const webp = await sharp(jpeg).webp().toBuffer();
  await confirmStoredImage(webp, webp.length);
  await assert.rejects(
    () => confirmStoredImage(webp.subarray(0, webp.length - 1), webp.length),
    ProductImageProcessingError,
    'short read-back is not a successful save',
  );

  console.log('upload-bytes.spec.ts: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

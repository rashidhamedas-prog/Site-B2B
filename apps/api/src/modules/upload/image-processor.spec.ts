import * as assert from 'node:assert/strict';
import {
  PRODUCT_IMAGE_HEIGHT,
  PRODUCT_IMAGE_WIDTH,
  ProductImageProcessingError,
  processProductImage,
} from './image-processor';

async function main() {
  const sharp = require('sharp') as typeof import('sharp');
  const oversized = await sharp({
    create: {
      width: 2400,
      height: 2000,
      channels: 3,
      background: { r: 33, g: 92, b: 74 },
    },
  })
    .png()
    .toBuffer();

  const processed = await processProductImage(oversized, 'image/png');
  const metadata = await sharp(processed.buffer).metadata();

  assert.equal(processed.mimetype, 'image/webp');
  assert.equal(processed.extension, 'webp');
  assert.equal(metadata.format, 'webp');
  assert.ok((metadata.width ?? Infinity) <= PRODUCT_IMAGE_WIDTH);
  assert.ok((metadata.height ?? Infinity) <= PRODUCT_IMAGE_HEIGHT);
  assert.ok(processed.buffer.length < oversized.length);

  await assert.rejects(
    () => processProductImage(Buffer.from('not an image'), 'image/jpeg'),
    ProductImageProcessingError
  );

  console.log('image-processor.spec.ts: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import * as assert from 'node:assert/strict';
import {
  CATEGORY_BANNER_SIZE,
  isProductImageTimeout,
  MAX_INPUT_PIXELS,
  parseImageProcessProfile,
  PRODUCT_IMAGE_HEIGHT,
  PRODUCT_IMAGE_WIDTH,
  ProductImageProcessingError,
  processCategoryBannerImage,
  processProductImage,
} from './image-processor';

async function main() {
  const sharp = require('sharp') as typeof import('sharp').default;
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

  assert.ok(MAX_INPUT_PIXELS > 48_000_000, '48MP phone JPEGs must be under the Sharp pixel cap');
  assert.ok(MAX_INPUT_PIXELS <= 60_000_000, 'pixel cap stays near phone sensors, not 120MP');
  assert.equal(
    isProductImageTimeout(new ProductImageProcessingError(new Error('timeout: 20000ms'))),
    true,
  );
  assert.equal(isProductImageTimeout(new ProductImageProcessingError(new Error('corrupt'))), false);

  const landscape = await sharp({
    create: {
      width: 1600,
      height: 900,
      channels: 3,
      background: { r: 180, g: 140, b: 90 },
    },
  })
    .png()
    .toBuffer();
  const banner = await processCategoryBannerImage(landscape, 'image/png');
  const bannerMeta = await sharp(banner.buffer).metadata();
  assert.equal(banner.mimetype, 'image/webp');
  assert.equal(bannerMeta.width, CATEGORY_BANNER_SIZE);
  assert.equal(bannerMeta.height, CATEGORY_BANNER_SIZE);
  assert.ok(banner.buffer.length < landscape.length);
  assert.equal(parseImageProcessProfile('category-banner'), 'categoryBanner');
  assert.equal(parseImageProcessProfile('product'), 'product');

  console.log('image-processor.spec.ts: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

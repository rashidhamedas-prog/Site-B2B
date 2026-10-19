/** Standard product image: 3:4 aspect, max 1200×1600, WebP output */
export const PRODUCT_IMAGE_WIDTH = 1200;
export const PRODUCT_IMAGE_HEIGHT = 1600;
export const PRODUCT_IMAGE_QUALITY = 82;
/** Category home banner: square 1:1 cover crop, WebP output */
export const CATEGORY_BANNER_SIZE = 1200;
export const CATEGORY_BANNER_QUALITY = 80;
/** 48MP phone sensors are ~50e6 pixels; 40e6 used to fail those uploads. */
export const MAX_INPUT_PIXELS = 60_000_000;
export const SHARP_TIMEOUT_SECONDS = 20;
export const MAX_SHARP_CONCURRENT = 2;

export type ImageProcessProfile = 'product' | 'categoryBanner';

let sharpInflight = 0;
const sharpWaiters: Array<() => void> = [];

async function withSharpSlot<T>(run: () => Promise<T>): Promise<T> {
  if (sharpInflight >= MAX_SHARP_CONCURRENT) {
    await new Promise<void>((resolve) => sharpWaiters.push(resolve));
  }
  sharpInflight += 1;
  try {
    return await run();
  } finally {
    sharpInflight -= 1;
    sharpWaiters.shift()?.();
  }
}

export interface ProcessedImage {
  buffer: Buffer;
  mimetype: string;
  extension: string;
}

export class ProductImageProcessingError extends Error {
  constructor(public readonly cause: unknown) {
    super('Product image processing failed');
    this.name = 'ProductImageProcessingError';
  }
}

export function isProductImageTimeout(error: unknown): boolean {
  const msg =
    error instanceof ProductImageProcessingError
      ? error.cause instanceof Error
        ? error.cause.message
        : String(error.cause ?? '')
      : error instanceof Error
        ? error.message
        : String(error ?? '');
  return /timeout/i.test(msg);
}

export async function processProductImage(input: Buffer, _mimetype: string): Promise<ProcessedImage> {
  return withSharpSlot(async () => {
    try {
      const sharp = require('sharp') as typeof import('sharp');
      const buffer = await sharp(input, {
        limitInputPixels: MAX_INPUT_PIXELS,
      })
        .timeout({ seconds: SHARP_TIMEOUT_SECONDS })
        .rotate()
        .resize(PRODUCT_IMAGE_WIDTH, PRODUCT_IMAGE_HEIGHT, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: PRODUCT_IMAGE_QUALITY, effort: 4 })
        .toBuffer();

      return { buffer, mimetype: 'image/webp', extension: 'webp' };
    } catch (error) {
      // Never persist the original multi-megabyte upload when processing or
      // the native sharp runtime is broken. The upload must fail explicitly.
      throw new ProductImageProcessingError(error);
    }
  });
}

/** Square cover crop for retail/wholesale home category tiles. */
export async function processCategoryBannerImage(
  input: Buffer,
  _mimetype: string,
): Promise<ProcessedImage> {
  return withSharpSlot(async () => {
    try {
      const sharp = require('sharp') as typeof import('sharp');
      const buffer = await sharp(input, {
        limitInputPixels: MAX_INPUT_PIXELS,
      })
        .timeout({ seconds: SHARP_TIMEOUT_SECONDS })
        .rotate()
        .resize(CATEGORY_BANNER_SIZE, CATEGORY_BANNER_SIZE, {
          fit: 'cover',
          position: 'centre',
        })
        .webp({ quality: CATEGORY_BANNER_QUALITY, effort: 4 })
        .toBuffer();

      return { buffer, mimetype: 'image/webp', extension: 'webp' };
    } catch (error) {
      throw new ProductImageProcessingError(error);
    }
  });
}

export async function processUploadImage(
  input: Buffer,
  mimetype: string,
  profile: ImageProcessProfile = 'product',
): Promise<ProcessedImage> {
  if (profile === 'categoryBanner') {
    return processCategoryBannerImage(input, mimetype);
  }
  return processProductImage(input, mimetype);
}

export function parseImageProcessProfile(raw: unknown): ImageProcessProfile {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (value === 'categorybanner' || value === 'category-banner' || value === 'category_banner') {
    return 'categoryBanner';
  }
  return 'product';
}

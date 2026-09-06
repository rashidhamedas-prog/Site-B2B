/** Standard product image: 3:4 aspect, max 1200×1600, WebP output */
export const PRODUCT_IMAGE_WIDTH = 1200;
export const PRODUCT_IMAGE_HEIGHT = 1600;
export const PRODUCT_IMAGE_QUALITY = 82;

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

export async function processProductImage(input: Buffer, _mimetype: string): Promise<ProcessedImage> {
  try {
    const sharp = require('sharp') as typeof import('sharp');
    const buffer = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(PRODUCT_IMAGE_WIDTH, PRODUCT_IMAGE_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: PRODUCT_IMAGE_QUALITY })
      .toBuffer();

    return { buffer, mimetype: 'image/webp', extension: 'webp' };
  } catch (error) {
    // Never persist the original multi-megabyte upload when processing or
    // the native sharp runtime is broken. The upload must fail explicitly.
    throw new ProductImageProcessingError(error);
  }
}

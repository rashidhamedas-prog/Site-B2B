/** Standard product image: 3:4 aspect, max 1200×1600, WebP output */
export const PRODUCT_IMAGE_WIDTH = 1200;
export const PRODUCT_IMAGE_HEIGHT = 1600;
export const PRODUCT_IMAGE_QUALITY = 82;

export interface ProcessedImage {
  buffer: Buffer;
  mimetype: string;
  extension: string;
}

export async function processProductImage(input: Buffer, mimetype: string): Promise<ProcessedImage> {
  try {
    const sharp = require('sharp');
    const buffer = await sharp(input)
      .rotate()
      .resize(PRODUCT_IMAGE_WIDTH, PRODUCT_IMAGE_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: PRODUCT_IMAGE_QUALITY })
      .toBuffer();

    return { buffer, mimetype: 'image/webp', extension: 'webp' };
  } catch {
    return { buffer: input, mimetype, extension: mimetype.includes('png') ? 'png' : 'jpg' };
  }
}

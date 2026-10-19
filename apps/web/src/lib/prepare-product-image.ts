import {
  CATEGORY_BANNER_SIZE,
  PRODUCT_IMAGE_HEIGHT,
  PRODUCT_IMAGE_WIDTH,
} from './upload-image';

/** Skip another encode when the file is already small enough for the Iran path. */
export const SKIP_PREPARE_BYTES = 1_200_000;

export function fitInside(
  width: number,
  height: number,
  maxW = PRODUCT_IMAGE_WIDTH,
  maxH = PRODUCT_IMAGE_HEIGHT,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: maxW, height: maxH };
  }
  const scale = Math.min(1, maxW / width, maxH / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function shouldPrepareProductImage(file: {
  type: string;
  size: number;
}): boolean {
  const type = String(file.type || '').toLowerCase();
  if (type === 'image/gif') return false;
  if (file.size > SKIP_PREPARE_BYTES) return true;
  return type === 'image/heic' || type === 'image/heif';
}

/**
 * Downscale in the browser so a 10–20MB phone JPEG is not POSTed raw.
 * Falls back to the original file if Canvas / ImageBitmap is missing.
 */
export async function prepareProductUploadFile(file: File): Promise<File> {
  if (typeof window === 'undefined' || typeof createImageBitmap !== 'function') return file;
  if (!shouldPrepareProductImage(file) && file.size <= SKIP_PREPARE_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const fitted = fitInside(bitmap.width, bitmap.height);
    const alreadyFits =
      fitted.width === bitmap.width &&
      fitted.height === bitmap.height &&
      file.size <= SKIP_PREPARE_BYTES &&
      file.type !== 'image/heic' &&
      file.type !== 'image/heif';
    if (alreadyFits) return file;

    const canvas = document.createElement('canvas');
    canvas.width = fitted.width;
    canvas.height = fitted.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, fitted.width, fitted.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82),
    );
    if (!blob || blob.size === 0) return file;
    const base = file.name.replace(/\.[^.]+$/, '') || 'product';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

/**
 * Center-crop to a square in the browser before POST so category banners
 * stay near the 1:1 home tile budget (server still re-encodes with Sharp).
 */
export async function prepareCategoryBannerUploadFile(file: File): Promise<File> {
  if (typeof window === 'undefined' || typeof createImageBitmap !== 'function') return file;
  if (!shouldPrepareProductImage(file) && file.size <= SKIP_PREPARE_BYTES) {
    // Still crop when dimensions are clearly not square and large enough to matter.
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const side = Math.min(bitmap.width, bitmap.height);
    if (side <= 0) return file;
    const alreadySquareSmall =
      bitmap.width === bitmap.height &&
      bitmap.width <= CATEGORY_BANNER_SIZE &&
      file.size <= SKIP_PREPARE_BYTES &&
      file.type !== 'image/heic' &&
      file.type !== 'image/heif';
    if (alreadySquareSmall) return file;

    const out = Math.min(CATEGORY_BANNER_SIZE, side);
    const sx = Math.floor((bitmap.width - side) / 2);
    const sy = Math.floor((bitmap.height - side) / 2);
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82),
    );
    if (!blob || blob.size === 0) return file;
    const base = file.name.replace(/\.[^.]+$/, '') || 'category-banner';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

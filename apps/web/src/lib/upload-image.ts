/** Keep in sync with apps/api/src/modules/upload/upload-image-policy.ts and image-processor.ts */
export const MAX_UPLOAD_IMAGE_BYTES = 20 * 1024 * 1024;
export const PRODUCT_IMAGE_WIDTH = 1200;
export const PRODUCT_IMAGE_HEIGHT = 1600;
export const UPLOAD_FETCH_TIMEOUT_MS = 120_000;
export const UPLOAD_TIMEOUT_MESSAGE =
  'آپلود بیش از حد طول کشید. اتصال را بررسی کنید یا عکس کوچک‌تری بفرستید.';

export function clientUploadImageRejection(file: { name: string; type: string; size: number }): string | null {
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  if (name.endsWith('.heic') || name.endsWith('.heif') || type === 'image/heic' || type === 'image/heif') {
    return 'عکس HEIC پشتیبانی نمی‌شود. آن را به JPG یا PNG تبدیل کنید.';
  }
  if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
    return 'حجم عکس بیشتر از ۲۰ مگابایت است.';
  }
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  const extOk = ['jpg', 'jpeg', 'jfif', 'png', 'webp', 'gif'].includes(ext);
  const mimeOk = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/gif'].includes(type);
  if (!extOk && !mimeOk) {
    return 'فرمت فایل مجاز نیست. jpg، png، webp یا gif بفرستید.';
  }
  return null;
}

/** Raw upload cap. Sharp then stores a small WebP; nginx allows 50MB. */
export const MAX_UPLOAD_IMAGE_BYTES = 20 * 1024 * 1024;

const EXT_KIND: Record<string, string> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  jfif: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
};

const MIME_KIND: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function filenameExtension(filename: string): string {
  const base = String(filename || '').split(/[/\\]/).pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase();
}

export function uploadImageKind(filename: string, mimetype: string): string {
  const ext = filenameExtension(filename);
  return EXT_KIND[ext] || MIME_KIND[String(mimetype || '').toLowerCase()] || '';
}

/** Null means the file may be processed. Size 0 skips the byte check (used before the stream is read). */
export function uploadImageRejection(filename: string, mimetype: string, size: number): string | null {
  const ext = filenameExtension(filename);
  const mime = String(mimetype || '').toLowerCase();
  if (ext === 'heic' || ext === 'heif' || mime === 'image/heic' || mime === 'image/heif') {
    return 'عکس HEIC پشتیبانی نمی‌شود. آن را به JPG یا PNG تبدیل کنید.';
  }
  if (size > MAX_UPLOAD_IMAGE_BYTES) {
    return 'حجم عکس بیشتر از ۲۰ مگابایت است.';
  }
  if (!uploadImageKind(filename, mimetype)) {
    return 'فرمت فایل مجاز نیست. jpg، png، webp یا gif بفرستید.';
  }
  return null;
}

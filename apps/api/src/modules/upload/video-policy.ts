/** Owner-approved video limits. Kept in code (not .env); enforced on server and client. */
export const VIDEO_MAX_BYTES = 200 * 1024 * 1024;
export const VIDEO_MAX_SEC = 60;
export const VIDEO_OUTPUTS = [720, 480] as const;
export const VIDEO_KEEP_ORIGINAL = false;
export const VIDEO_WEBM = true;
export const VIDEO_MIN_FREE_DISK_BYTES = 5 * 1024 * 1024 * 1024;
export const FFMPEG_TIMEOUT_MS = 600_000;
export const FFMPEG_THREADS = 2;
export const VIDEO_JSONLD_ENABLED = false;

/** Private bucket for raw uploads. Never attach a public policy to it. */
export const VIDEO_SRC_BUCKET = 'taranom-video-src';

export const PRODUCT_VIDEO_STATUSES = ['uploading', 'queued', 'processing', 'ready', 'failed'] as const;
export type ProductVideoStatus = (typeof PRODUCT_VIDEO_STATUSES)[number];

export const PRODUCT_VIDEO_ERROR_CODES = [
  'DISK_LOW',
  'TOO_LONG',
  'NO_VIDEO_STREAM',
  'PROBE_FAILED',
  'TRANSCODE_FAILED',
  'TIMEOUT',
  'UPLOAD_ABORTED',
] as const;
export type ProductVideoErrorCode = (typeof PRODUCT_VIDEO_ERROR_CODES)[number];

/** Payload of OUTBOX_EVENT_TYPES.PRODUCT_VIDEO_TRANSCODE. IDs only. */
export interface ProductVideoTranscodePayload {
  videoId: string;
  productId: string;
}

export const VIDEO_ERROR_MESSAGES = {
  TOO_BIG: 'حجم ویدیو بیشتر از ۲۰۰ مگابایت است.',
  BAD_TYPE: 'فرمت ویدیو مجاز نیست. mp4، mov یا webm بفرستید.',
  TOO_LONG: 'مدت ویدیو بیشتر از ۶۰ ثانیه است.',
} as const;

export type VideoMagicKind = 'iso-bmff' | 'webm';

/** Identifies only the container signature; codecs are validated by the worker probe. */
export function sniffVideoMagic(head: Buffer): VideoMagicKind | null {
  if (head.length >= 8 && head.subarray(4, 8).toString('ascii') === 'ftyp') {
    return 'iso-bmff';
  }
  if (
    head.length >= 4 &&
    head[0] === 0x1a &&
    head[1] === 0x45 &&
    head[2] === 0xdf &&
    head[3] === 0xa3
  ) {
    return 'webm';
  }
  return null;
}

export function videoUploadRejection(
  filename: string,
  mimetype: string,
  size: number,
  head: Buffer,
): string | null {
  if (size > VIDEO_MAX_BYTES) return VIDEO_ERROR_MESSAGES.TOO_BIG;

  const ext = /\.([^.]+)$/.exec(String(filename || '').toLowerCase())?.[1] ?? '';
  const mime = String(mimetype || '').toLowerCase().split(';', 1)[0].trim();
  const magic = sniffVideoMagic(head);

  const allowed =
    (ext === 'mp4' && mime === 'video/mp4' && magic === 'iso-bmff') ||
    (ext === 'mov' && mime === 'video/quicktime' && magic === 'iso-bmff') ||
    (ext === 'webm' && mime === 'video/webm' && magic === 'webm');

  return allowed ? null : VIDEO_ERROR_MESSAGES.BAD_TYPE;
}

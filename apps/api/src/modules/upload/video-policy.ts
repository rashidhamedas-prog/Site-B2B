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

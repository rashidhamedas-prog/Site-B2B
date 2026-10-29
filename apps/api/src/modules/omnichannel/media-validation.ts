/**
 * PR-11: pure channel-photo readiness (EOI / decode / size).
 * Reuses upload-bytes + CHANNEL_PHOTO_MAX_BYTES — no third size constant (C5).
 * Zero adapter / Bot API I/O.
 */
import { CHANNEL_PHOTO_MAX_BYTES } from '../upload/channel-image';
import {
  assertDecodableImage,
  jpegEndsWithEoi,
  rejectTruncatedJpeg,
} from '../upload/upload-bytes';
import { ProductImageProcessingError } from '../upload/image-processor';

export const MEDIA_HEALTH_ISSUES = [
  'ok',
  'truncated',
  'undecodable',
  'oversized',
  'needs_replace',
  'unknown',
] as const;

export type MediaHealthIssue = (typeof MEDIA_HEALTH_ISSUES)[number];

export type MediaValidateResult = {
  ok: boolean;
  code?: Exclude<MediaHealthIssue, 'ok' | 'needs_replace' | 'unknown'>;
  messageFa: string;
  bytes: number;
  width?: number;
  height?: number;
  format?: string;
};

/** Same Persian codes as upload controller — surfaced in omnichannel Media tab. */
export const MEDIA_MESSAGE_FA = {
  truncated: 'فایل JPEG ناقص است. اول تصویر را اصلاح کنید.',
  undecodable: 'این فایل به‌عنوان تصویر خوانده نشد. اول تصویر را اصلاح کنید.',
  oversized: 'عکس برای کانال‌ها بزرگ است. اول تصویر را اصلاح کنید.',
  ok: 'تصویر سالم است.',
  unsupported_media: 'unsupported_media: اول تصویر را اصلاح کنید',
} as const;

export function channelPhotoMaxBytes(): number {
  return CHANNEL_PHOTO_MAX_BYTES;
}

export function isTruncatedJpeg(buffer: Buffer): boolean {
  if (buffer.length < 2) return false;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
  return !jpegEndsWithEoi(buffer);
}

/**
 * Decode + EOI + size vs CHANNEL_PHOTO_MAX_BYTES (1.8 MiB).
 * Does not call messengers or rewrite storage.
 */
export async function validateImageBuffer(buffer: Buffer): Promise<MediaValidateResult> {
  const bytes = buffer?.length || 0;
  if (!bytes) {
    return {
      ok: false,
      code: 'undecodable',
      messageFa: MEDIA_MESSAGE_FA.undecodable,
      bytes: 0,
    };
  }
  if (isTruncatedJpeg(buffer)) {
    return {
      ok: false,
      code: 'truncated',
      messageFa: MEDIA_MESSAGE_FA.truncated,
      bytes,
    };
  }
  try {
    rejectTruncatedJpeg(buffer);
    const meta = await assertDecodableImage(buffer);
    if (bytes > CHANNEL_PHOTO_MAX_BYTES) {
      return {
        ok: false,
        code: 'oversized',
        messageFa: MEDIA_MESSAGE_FA.oversized,
        bytes,
        width: meta.width,
        height: meta.height,
        format: meta.format,
      };
    }
    return {
      ok: true,
      messageFa: MEDIA_MESSAGE_FA.ok,
      bytes,
      width: meta.width,
      height: meta.height,
      format: meta.format,
    };
  } catch (err) {
    const cause =
      err instanceof ProductImageProcessingError
        ? err.cause instanceof Error
          ? err.cause.message
          : String(err.cause ?? err)
        : err instanceof Error
          ? err.message
          : String(err);
    if (/EOI|truncated/i.test(cause)) {
      return {
        ok: false,
        code: 'truncated',
        messageFa: MEDIA_MESSAGE_FA.truncated,
        bytes,
      };
    }
    return {
      ok: false,
      code: 'undecodable',
      messageFa: MEDIA_MESSAGE_FA.undecodable,
      bytes,
    };
  }
}

/**
 * Sync/async gate for compose confirm + worker prepare.
 * Throws Error whose message starts with `unsupported_media` (Q6 non-retryable).
 */
export async function assertChannelPhotoReady(buffer: Buffer): Promise<MediaValidateResult> {
  const result = await validateImageBuffer(buffer);
  if (!result.ok) {
    const err = new Error(MEDIA_MESSAGE_FA.unsupported_media);
    (err as Error & { code?: string; mediaIssue?: string }).code = 'unsupported_media';
    (err as Error & { mediaIssue?: string }).mediaIssue = result.code;
    throw err;
  }
  return result;
}

export function mediaIssueLabelFa(issue: string | null | undefined): string {
  switch (issue) {
    case 'truncated':
      return 'JPEG ناقص (بدون EOI)';
    case 'undecodable':
      return 'غیرقابل‌خواندن';
    case 'oversized':
      return 'بزرگ‌تر از سقف کانال';
    case 'needs_replace':
      return 'نیاز به جایگزینی';
    case 'ok':
      return 'سالم';
    default:
      return 'نامشخص';
  }
}

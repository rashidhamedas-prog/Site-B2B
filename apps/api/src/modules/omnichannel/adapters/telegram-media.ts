import { publicProductPhotoUrl } from '../publication-template';
import { sanitizeObjectKey } from '../../upload/storage-delete';
import {
  prepareChannelJpeg,
  type PreparedChannelJpeg,
} from '../../upload/channel-image';

/**
 * `url` (default): sendPhoto / sendMediaGroup keep passing https URLs.
 * Telegram's servers then fetch them and fail with WEBPAGE_CURL_FAILED when the
 * host only resolves on the Iran origin.
 * `upload`: this process reads the object and POSTs multipart through TELEGRAM_API_URL.
 * Any other value stays on `url` so a typo cannot change live delivery.
 */
export type TelegramMediaUploadMode = 'upload' | 'url';

export function telegramMediaUploadMode(
  source: { TELEGRAM_MEDIA_UPLOAD_MODE?: string | undefined } = process.env,
): TelegramMediaUploadMode {
  return String(source.TELEGRAM_MEDIA_UPLOAD_MODE ?? '').trim().toLowerCase() === 'upload' ? 'upload' : 'url';
}

/** Stay under the Bot API photo cap (10 MB) after JPEG encode. */
export const TELEGRAM_PHOTO_MAX_BYTES = 9 * 1024 * 1024;
export const TELEGRAM_PHOTO_LONG_EDGE = 2560;
export const TELEGRAM_JPEG_QUALITY = 82;
export const TELEGRAM_PHOTO_FETCH_TIMEOUT_MS = 12_000;
export const TELEGRAM_UPLOAD_TIMEOUT_MS = 28_000;
/** Fetch + Sharp on the API, not on the storefront request path. Two at a time matches product uploads. */
export const TELEGRAM_PHOTO_CONCURRENCY = 2;

const PHOTO_FETCH_MAX_BYTES = 15 * 1024 * 1024;

export type PreparedTelegramPhoto = PreparedChannelJpeg;

export function isAllowlistedPhotoUrl(url: string): boolean {
  return publicProductPhotoUrl('WHOLESALE', url) !== null;
}

/** `/media/products/…` and `/media/blog/…` map to MinIO keys. Other allowlisted paths use HTTPS. */
export function ownedProductMediaKey(url: string): string | null {
  if (!isAllowlistedPhotoUrl(url)) return null;
  let pathname = '';
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const marker = '/media/';
  const at = pathname.indexOf(marker);
  if (at === -1) return null;
  return sanitizeObjectKey(pathname.slice(at + marker.length));
}

export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Math.min(Math.max(1, limit), items.length);
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        out[index] = await fn(items[index], index);
      }
    }),
  );
  return out;
}

/**
 * WebP (and anything else Sharp can read) becomes a JPEG Telegram can accept as a photo.
 * Long edge is capped so an album stays inside Worker and Bot API limits.
 * Encoding loop lives in `prepareChannelJpeg`; Telegram keeps the 9 MB / 2560 defaults.
 */
export async function prepareTelegramUpload(input: Buffer): Promise<PreparedTelegramPhoto> {
  return prepareChannelJpeg(input, {
    maxBytes: TELEGRAM_PHOTO_MAX_BYTES,
    longEdge: TELEGRAM_PHOTO_LONG_EDGE,
    minQuality: 55,
  });
}

export async function loadOwnedPhotoBytes(
  url: string,
  deps: {
    readStorage?: (key: string) => Promise<Buffer>;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  },
): Promise<Buffer> {
  if (!isAllowlistedPhotoUrl(url)) throw new Error('photo_host_rejected');
  const key = ownedProductMediaKey(url);
  if (key && deps.readStorage) {
    try {
      const fromStorage = await deps.readStorage(key);
      if (fromStorage?.length) return fromStorage;
    } catch {
      // Missing object: same-origin HTTPS below. The Iran host can fetch its own media.
    }
  }
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const res = await fetchImpl(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(deps.timeoutMs ?? TELEGRAM_PHOTO_FETCH_TIMEOUT_MS),
  });
  if (res.status >= 300 && res.status < 400) throw new Error('photo_fetch_failed');
  if (!res.ok) throw new Error('photo_fetch_failed');
  const declared = Number(res.headers.get('content-length') || '');
  if (Number.isFinite(declared) && declared > PHOTO_FETCH_MAX_BYTES) throw new Error('photo_too_large');
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length) throw new Error('photo_fetch_failed');
  if (bytes.length > PHOTO_FETCH_MAX_BYTES) throw new Error('photo_too_large');
  return bytes;
}

function filePart(bytes: Buffer, contentType: string, filename: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type: contentType });
}

export function buildTelegramPhotoForm(input: {
  chatId: string;
  photo: PreparedTelegramPhoto;
  caption?: string;
  parseMode?: string;
  captionAbove?: boolean;
  silent?: boolean;
  protectContent?: boolean;
  replyMarkup?: unknown;
}): FormData {
  const form = new FormData();
  form.append('chat_id', input.chatId);
  form.append('photo', filePart(input.photo.bytes, input.photo.contentType, input.photo.filename), input.photo.filename);
  if (input.caption) form.append('caption', input.caption);
  if (input.parseMode) form.append('parse_mode', input.parseMode);
  if (input.captionAbove) form.append('show_caption_above_media', 'true');
  if (input.silent) form.append('disable_notification', 'true');
  if (input.protectContent) form.append('protect_content', 'true');
  if (input.replyMarkup) form.append('reply_markup', JSON.stringify(input.replyMarkup));
  return form;
}

export function buildTelegramAlbumForm(input: {
  chatId: string;
  photos: PreparedTelegramPhoto[];
  caption?: string;
  parseMode?: string;
  silent?: boolean;
  protectContent?: boolean;
}): FormData {
  const form = new FormData();
  form.append('chat_id', input.chatId);
  const media = input.photos.map((photo, index) => {
    const name = `photo${index}`;
    form.append(name, filePart(photo.bytes, photo.contentType, `${name}.jpg`), `${name}.jpg`);
    return {
      type: 'photo',
      media: `attach://${name}`,
      ...(index === 0 && input.caption
        ? { caption: input.caption, ...(input.parseMode ? { parse_mode: input.parseMode } : {}) }
        : {}),
    };
  });
  form.append('media', JSON.stringify(media));
  if (input.silent) form.append('disable_notification', 'true');
  if (input.protectContent) form.append('protect_content', 'true');
  return form;
}

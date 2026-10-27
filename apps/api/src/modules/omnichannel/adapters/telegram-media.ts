import { publicProductPhotoUrl } from '../publication-template';
import { sanitizeObjectKey } from '../../upload/storage-delete';

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

export type PreparedTelegramPhoto = {
  bytes: Buffer;
  filename: string;
  contentType: string;
};

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

function loadSharp(): ((...args: any[]) => any) | null {
  try {
    const mod = require('sharp') as any;
    return typeof mod === 'function' ? mod : mod.default;
  } catch {
    return null;
  }
}

function sniffImage(bytes: Buffer): { contentType: string; filename: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: 'image/jpeg', filename: 'photo.jpg' };
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { contentType: 'image/png', filename: 'photo.png' };
  }
  if (
    bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { contentType: 'image/webp', filename: 'photo.webp' };
  }
  return null;
}

/**
 * WebP (and anything else Sharp can read) becomes a JPEG Telegram can accept as a photo.
 * Long edge is capped so an album stays inside Worker and Bot API limits.
 * If Sharp is not installed, the original bytes are uploaded when they already fit.
 */
export async function prepareTelegramUpload(input: Buffer): Promise<PreparedTelegramPhoto> {
  if (!input.length) throw new Error('photo_unreadable');
  const sharp = loadSharp();
  if (!sharp) {
    if (input.length > TELEGRAM_PHOTO_MAX_BYTES) throw new Error('photo_too_large');
    const sniffed = sniffImage(input);
    if (!sniffed) throw new Error('photo_unreadable');
    return { bytes: input, ...sniffed };
  }
  let quality = TELEGRAM_JPEG_QUALITY;
  let edge = TELEGRAM_PHOTO_LONG_EDGE;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let bytes: Buffer;
    try {
      bytes = await sharp(input, { failOn: 'warning', limitInputPixels: 60_000_000 })
        .rotate()
        .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality })
        .timeout({ seconds: 15 })
        .toBuffer();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/timeout/i.test(message)) {
        const timeout = new Error('timeout');
        timeout.name = 'TimeoutError';
        throw timeout;
      }
      throw new Error('photo_unreadable');
    }
    if (bytes.length && bytes.length <= TELEGRAM_PHOTO_MAX_BYTES && sniffImage(bytes)?.contentType === 'image/jpeg') {
      return { bytes, filename: 'photo.jpg', contentType: 'image/jpeg' };
    }
    quality = Math.max(55, quality - 10);
    edge = Math.max(1280, Math.round(edge * 0.75));
  }
  throw new Error('photo_too_large');
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

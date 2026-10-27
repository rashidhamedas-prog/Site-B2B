import {
  CHANNEL_PHOTO_LONG_EDGE,
  CHANNEL_PHOTO_MAX_BYTES,
  type PreparedChannelJpeg,
  prepareChannelJpeg,
} from '../../upload/channel-image';
import { TELEGRAM_UPLOAD_TIMEOUT_MS } from './telegram-media';

/**
 * `url` (default): sendPhoto / sendMediaGroup pass https URLs (Bale fetches them).
 * `upload`: this process reads MinIO / same-origin HTTPS and POSTs multipart to tapi.bale.ai.
 */
export type BaleMediaUploadMode = 'upload' | 'url';

export function baleMediaUploadMode(
  source: { BALE_MEDIA_UPLOAD_MODE?: string | undefined } = process.env,
): BaleMediaUploadMode {
  return String(source.BALE_MEDIA_UPLOAD_MODE ?? '').trim().toLowerCase() === 'upload' ? 'upload' : 'url';
}

/** Bale practical photo cap — same derivative as site uploads (.channel.jpg). */
export const BALE_PHOTO_MAX_BYTES = CHANNEL_PHOTO_MAX_BYTES;
export const BALE_PHOTO_LONG_EDGE = CHANNEL_PHOTO_LONG_EDGE;
export const BALE_UPLOAD_TIMEOUT_MS = TELEGRAM_UPLOAD_TIMEOUT_MS;

export type PreparedBalePhoto = PreparedChannelJpeg;

export async function prepareBaleUpload(input: Buffer): Promise<PreparedBalePhoto> {
  return prepareChannelJpeg(input, {
    maxBytes: BALE_PHOTO_MAX_BYTES,
    longEdge: BALE_PHOTO_LONG_EDGE,
    minQuality: 55,
  });
}

function filePart(bytes: Buffer, contentType: string, filename: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type: contentType });
}

/** Bale sendPhoto — Markdown caption only; no parse_mode / notification flags. */
export function buildBalePhotoForm(input: {
  chatId: string;
  photo: PreparedBalePhoto;
  caption?: string;
  replyMarkup?: unknown;
}): FormData {
  const form = new FormData();
  form.append('chat_id', input.chatId);
  form.append('photo', filePart(input.photo.bytes, input.photo.contentType, input.photo.filename), input.photo.filename);
  if (input.caption) form.append('caption', input.caption);
  if (input.replyMarkup) form.append('reply_markup', JSON.stringify(input.replyMarkup));
  return form;
}

export function buildBaleAlbumForm(input: {
  chatId: string;
  photos: PreparedBalePhoto[];
  caption?: string;
}): FormData {
  const form = new FormData();
  form.append('chat_id', input.chatId);
  const media = input.photos.map((photo, index) => {
    const name = `photo${index}`;
    form.append(name, filePart(photo.bytes, photo.contentType, `${name}.jpg`), `${name}.jpg`);
    return {
      type: 'photo',
      media: `attach://${name}`,
      ...(index === 0 && input.caption ? { caption: input.caption } : {}),
    };
  });
  form.append('media', JSON.stringify(media));
  return form;
}
